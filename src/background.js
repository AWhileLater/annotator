/* ===== Web Annotator Service Worker：消息路由 + 截图 ===== */
'use strict';

// 接受来自 popup 的保活连接：长连接端口会让 service worker 在 popup 打开期间
// 保持存活，消除 popup→SW 消息的 service-worker 唤醒竞态（避免 “Receiving end
// does not exist”）。
chrome.runtime.onConnect.addListener(function () {});

// 快捷键命令（manifest.commands）：Ctrl+. 在当前页面“切换”标注模式（开→关）。
// 具体按键可在浏览器扩展快捷键设置页重绑（设置界面提供跳转入口）。
// 切换逻辑放在内容脚本：以当前 active 状态为准，避免 background 维护重复状态。
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function (command) {
    if (command === 'start-annotation') {
      getActiveTab().then(function (tab) {
        if (tab) sendToTab(tab.id, { type: 'WA_TOGGLE' });
      });
    }
  });
}

function sendToTab(tabId, msg) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, msg, (resp) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(resp);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs && tabs[0] ? tabs[0] : null);
    });
  });
}

// 读取截图最长边设置（chrome.storage.local.wa_shotMaxEdge）。
// 'original' 或不存 → 不缩放；数字 → 按最长边缩放到该像素值。
// 默认 1024：在多数模型的图像 token 上限内明显更省，同时保留气泡可读性。
function getEdge() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('wa_shotMaxEdge', (o) => {
        const v = o && o.wa_shotMaxEdge;
        if (v === undefined || v === null || v === '') resolve('1024');
        else resolve(v);
      });
    } catch (e) {
      resolve('1024');
    }
  });
}

// 按最长边把截图缩放到 maxEdge 像素（降低发送给 LLM 的图像 token 消耗）。
// 任何失败一律降级返回原图，绝不阻断截图流程。SERVICE WORKER 环境使用 OffscreenCanvas。
async function resizeDataUrl(dataUrl, maxEdge) {
  const maxEdgeNum = Number(maxEdge);
  if (!maxEdgeNum || maxEdgeNum <= 0) return dataUrl;
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const longest = Math.max(bmp.width, bmp.height);
    if (longest <= maxEdgeNum) {
      if (bmp.close) bmp.close();
      return dataUrl; // 已小于目标，无需缩放
    }
    const scale = maxEdgeNum / longest;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const out = await canvas.convertToBlob({ type: 'image/png' });
    const dataUrl2 = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(out);
    });
    return dataUrl2;
  } catch (e) {
    return dataUrl; // 降级：保持原图
  }
}

async function captureScreenshot() {
  const tab = await getActiveTab();
  if (!tab) return { ok: false, error: 'no active tab' };
  // 隐藏悬停框/输入框，保证截图中只剩气泡
  await sendToTab(tab.id, { type: 'WA_HIDE_OVERLAY' });
  await new Promise((r) => setTimeout(r, 120));
  const shot = await new Promise((resolve) => {
    chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        resolve({ ok: false, error: (chrome.runtime.lastError || {}).message || 'capture failed' });
      } else {
        resolve({ ok: true, dataUrl: dataUrl });
      }
    });
  });
  if (!shot.ok) return shot;
  // 按设置缩放截图以降低图像 token；'original' 或读取失败保持原图
  let dataUrl = shot.dataUrl;
  const edge = await getEdge();
  if (edge !== 'original') {
    try {
      const resized = await resizeDataUrl(dataUrl, edge);
      if (resized) dataUrl = resized;
    } catch (e) {
      /* 降级用原图 */
    }
  }
  return { ok: true, dataUrl: dataUrl };
}

async function getAnnotations() {
  const tab = await getActiveTab();
  if (!tab) return { ok: false, error: 'no active tab' };
  const resp = await sendToTab(tab.id, { type: 'WA_GET' });
  if (!resp) return { ok: false, error: 'content script not injected (possibly chrome:// or a restricted page)' };
  return { ok: true, payload: resp };
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || !msg.type) return;
  if (msg.type === 'WA_CAPTURE') {
    captureScreenshot().then(sendResponse);
    return true;
  }
  if (msg.type === 'WA_GET_ANNOTATIONS') {
    getAnnotations().then(sendResponse);
    return true;
  }
  // 内容脚本请求重新打开弹窗：SW 才有 chrome.action 权限，且 Chrome 下无需用户手势
  if (msg.type === 'WA_OPEN_POPUP') {
    try {
      const p = chrome.action.openPopup();
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
    return; // 不需要回应
  }
});
