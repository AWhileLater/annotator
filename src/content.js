/* ===== Web Annotator 内容脚本：标注引擎 ===== */
(function () {
  'use strict';

  const F = (typeof window !== 'undefined' && window.AnnoFormat) || {};
  const WA = (typeof window !== 'undefined' && window.WA) || { t: (k) => k, get: () => 'zh', load: (cb) => cb && cb('zh'), set: (l, cb) => cb && cb(l) };
  // 内容脚本启动时从 storage 读语言偏好（默认中文），保证点开弹窗时使用正确语言
  if (WA.load) WA.load();
  // 让页面内弹窗跟随 popup 的主题选择（wa_theme: null=跟随系统 / light / dark）
  function applyTheme() {
    try {
      chrome.storage.local.get('wa_theme', function (r) {
        const t = (r && r.wa_theme) || null;
        if (t) document.documentElement.setAttribute('data-wa-theme', t);
        else document.documentElement.removeAttribute('data-wa-theme');
      });
    } catch (e) {}
  }
  applyTheme();
  // popup 里切换主题时即时同步到页面（即便弹窗已开）
  if (chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes.wa_theme) applyTheme();
    });
  }
  const annotations = [];
  const overlays = []; // { idx, el, bubble, region } 已保存标注的覆盖层，随页面滚动/缩放重定位

  let active = false;
  let hoverBox = null;
  let selectorLabel = null;
  let popover = null;
  let pendingEl = null;

  function ensureHoverBox() {
    if (hoverBox) return hoverBox;
    hoverBox = document.createElement('div');
    hoverBox.id = 'wa-hover-box';
    hoverBox.style.display = 'none';
    document.documentElement.appendChild(hoverBox);
    return hoverBox;
  }

  function ensureSelectorLabel() {
    if (selectorLabel) return selectorLabel;
    selectorLabel = document.createElement('div');
    selectorLabel.id = 'wa-selector-label';
    selectorLabel.style.display = 'none';
    document.documentElement.appendChild(selectorLabel);
    return selectorLabel;
  }

  function showHover(el) {
    const r = el.getBoundingClientRect();
    ensureHoverBox();
    hoverBox.style.display = 'block';
    hoverBox.style.left = r.left + 'px';
    hoverBox.style.top = r.top + 'px';
    hoverBox.style.width = r.width + 'px';
    hoverBox.style.height = r.height + 'px';
    // 在悬停红框旁预览该元素的 selector
    ensureSelectorLabel();
    const sel = (F.getSelector ? F.getSelector(el) : (el.tagName ? el.tagName.toLowerCase() : ''));
    selectorLabel.textContent = sel;
    selectorLabel.style.display = 'block';
    selectorLabel.style.maxWidth = Math.max(120, window.innerWidth - 24) + 'px';
    // 默认放在红框上方左对齐；顶部空间不足则放红框下方
    let top = r.top >= 22 ? r.top - 20 : r.top + r.height + 4;
    let left = r.left;
    // 横向避免溢出视口右边界
    const approxW = Math.min(selectorLabel.scrollWidth || 200, window.innerWidth - 24);
    if (left + approxW > window.innerWidth - 8) left = window.innerWidth - 8 - approxW;
    if (left < 8) left = 8;
    selectorLabel.style.left = left + 'px';
    selectorLabel.style.top = top + 'px';
  }

  function hideHover() {
    if (hoverBox) hoverBox.style.display = 'none';
    if (selectorLabel) selectorLabel.style.display = 'none';
  }

  function pickTargetText(el) {
    const cand =
      (el.getAttribute && el.getAttribute('aria-label')) ||
      (el.innerText && el.innerText.trim()) ||
      (el.getAttribute && el.getAttribute('alt')) ||
      (el.getAttribute && el.getAttribute('title')) ||
      (el.getAttribute && el.getAttribute('placeholder')) ||
      '';
    return cand.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function closePopover() {
    if (popover) {
      popover.remove();
      popover = null;
    }
    pendingEl = null;
    hideHover(); // 关闭输入框时同步隐藏临时红框
  }

  function openPopover(el, clientX, clientY) {
    closePopover();
    applyTheme(); // 确保弹窗使用最新主题
    pendingEl = el;
    showHover(el); // 在点击的元素上显示红框，与输入框共存
    popover = document.createElement('div');
    popover.id = 'wa-input-popover';
    popover.innerHTML =
      '<textarea placeholder="' + WA.t('popoverPlaceholder') + '"></textarea>' +
      '<div class="wa-row"><button class="wa-cancel">' + WA.t('cancel') + '</button>' +
      '<button class="wa-ok">' + WA.t('save') + '</button></div>';
    document.documentElement.appendChild(popover);
    const tx = popover.querySelector('textarea');
    const ok = popover.querySelector('.wa-ok');
    const cancel = popover.querySelector('.wa-cancel');
    // 定位到点击处附近，限制在视口内
    const px = Math.min(Math.max(clientX + 8, 8), window.innerWidth - 268);
    const py = Math.min(Math.max(clientY + 8, 8), window.innerHeight - 160);
    popover.style.left = px + 'px';
    popover.style.top = py + 'px';
    cancel.addEventListener('click', closePopover);
    ok.addEventListener('click', function () {
      const note = tx.value.trim();
      if (note) {
        addAnnotation(el, note);
        closePopover();
        stop(); // 单次标注后自动结束标注模式（气泡/区域边框保留）
        safeSend({ type: 'WA_MODE_ENDED' });
        openPopup(); // 保存后重新打开插件 UI，展示更新后的标注列表
      } else {
        closePopover(); // 取消输入不结束模式，可继续点其他元素
      }
    });
    setTimeout(function () { tx.focus(); }, 30);
  }

  function addAnnotation(el, note) {
    const r = el.getBoundingClientRect();
    const index = F.nextIndex ? F.nextIndex(annotations) : annotations.length + 1;
    const meta = {
      index: index,
      note: note,
      targetText: pickTargetText(el),
      selector: F.getSelector ? F.getSelector(el) : '',
      domPath: F.getDomPath ? F.getDomPath(el) : '',
      position: { x: Math.round(r.left), y: Math.round(r.top) },
      viewport: window.innerWidth + 'x' + window.innerHeight,
      pageUrl: location.href,
      frame: window === window.top ? 'main' : location.href
    };
    annotations.push(meta);
    const rec = { idx: meta.index, el: el, bubble: createBubble(meta), region: createRegion(meta) };
    overlays.push(rec);
    positionOverlay(rec);
    notifyCount();
  }

  // 计算气泡（序号）的放置位置：默认元素左上角，贴边时自动挪到元素内部
  function bubblePos(r) {
    const size = 22;
    let left = r.left - size / 2;
    let top = r.top - size / 2;
    if (top < 4) top = r.top + r.height / 2;
    if (left < 4) left = r.left + r.width / 2;
    return { left: left, top: top };
  }

  function createBubble(meta) {
    const b = document.createElement('div');
    b.className = 'wa-bubble';
    b.textContent = String(meta.index);
    b.dataset.idx = meta.index;
    document.documentElement.appendChild(b);
    return b;
  }

  function createRegion(meta) {
    const el = document.createElement('div');
    el.className = 'wa-region';
    el.dataset.idx = meta.index;
    document.documentElement.appendChild(el);
    return el;
  }

  // 按目标元素“当前”在视口中的位置重定位气泡/区域边框。position:fixed + 视口坐标，
  // 滚动/缩放时由 repositionAll 重算，从而让已完成的标注跟随页面元素一起移动。
  function positionOverlay(rec) {
    const el = rec.el;
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    // 元素已被移除（宽高均为 0）时隐藏覆盖层，避免残留在视口左上角
    if (r.width === 0 && r.height === 0) {
      rec.bubble.style.display = 'none';
      rec.region.style.display = 'none';
      return;
    }
    rec.bubble.style.display = '';
    rec.region.style.display = '';
    const bp = bubblePos(r);
    rec.bubble.style.left = bp.left + 'px';
    rec.bubble.style.top = bp.top + 'px';
    rec.region.style.left = r.left + 'px';
    rec.region.style.top = r.top + 'px';
    rec.region.style.width = r.width + 'px';
    rec.region.style.height = r.height + 'px';
  }

  function repositionAll() {
    for (let i = 0; i < overlays.length; i++) positionOverlay(overlays[i]);
  }

  // 滚动/缩放时让已完成的标注跟随页面元素；用 rAF 节流避免高频抖动
  let scrollScheduled = false;
  function onViewportChange() {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(function () {
      scrollScheduled = false;
      repositionAll();
    });
  }
  // 捕获阶段监听：连页面内的嵌套滚动容器也能响应
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);

  // 安全地发送（fire-and-forget）：MV3 下即便传了 callback，sendMessage 返回的
  // Promise 在「接收端不存在」时仍会 reject 且未捕获。这里用 .catch 兜底，避免
  // “Could not establish connection. Receiving end does not exist.” 未捕获报错。
  function safeSend(msg) {
    try {
      const p = chrome.runtime.sendMessage(msg);
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {}
  }

  function notifyCount() {
    safeSend({ type: 'ANNO_COUNT', count: annotations.length });
  }

  // 程序化重新打开插件弹窗：内容脚本无法访问 chrome.action，改为通知 service
  // worker 代为调用 chrome.action.openPopup()（Chrome 在 SW 中调用无需用户手势）。
  function openPopup() {
    safeSend({ type: 'WA_OPEN_POPUP' });
  }

  // 清除所有标注：移除气泡/区域边框、重置内存数据、关闭可能的输入框
  function clearAll() {
    closePopover();
    document.querySelectorAll('.wa-bubble').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.wa-region').forEach(function (el) { el.remove(); });
    annotations.length = 0;
    overlays.length = 0;
    notifyCount();
    return { ok: true, count: 0 };
  }

  function isSelfUI(target) {
    return target && target.closest && target.closest('#wa-hover-box, #wa-input-popover, .wa-bubble');
  }

  function onMouseMove(e) {
    if (!active) return;
    if (popover) return; // 输入框打开时冻结红框，不跟随鼠标、也不隐藏
    const t = e.target;
    if (isSelfUI(t)) { hideHover(); return; }
    if (t && t.nodeType === 1) showHover(t);
  }

  function onClick(e) {
    if (!active) return;
    const t = e.target;
    if (isSelfUI(t)) return; // 不拦截自身 UI
    // 阻止页面原生点击（链接跳转 / 按钮响应等），标注模式下页面只读
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (t && t.nodeType === 1) {
      openPopover(t, e.clientX, e.clientY);
    }
  }

  // 标注模式下吞掉页面的原生交互事件（除自身 UI 外），防止跳转/元素变化
  const SWALLOW_EVENTS = [
    'mousedown', 'mouseup', 'dblclick', 'auxclick',
    'pointerdown', 'pointerup', 'contextmenu', 'submit'
  ];
  function swallowEvent(e) {
    if (!active) return;
    if (isSelfUI(e.target)) return; // 自身输入框/按钮放行
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  // ESC 中断：终止整个标注会话，并重新打开插件 UI（用户手势内调用 openPopup）
  function onKeyDown(e) {
    if (!active) return;
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      if (popover) closePopover();
      stop();
      safeSend({ type: 'WA_ANNO_STOPPED' });
      openPopup(); // 重新打开插件 UI，方便用户继续操作
    }
  }

  function start() {
    active = true;
    document.documentElement.classList.add('web-annotator-active');
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    for (let i = 0; i < SWALLOW_EVENTS.length; i++) {
      document.addEventListener(SWALLOW_EVENTS[i], swallowEvent, true);
    }
  }

  function stop() {
    active = false;
    document.documentElement.classList.remove('web-annotator-active');
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    for (let i = 0; i < SWALLOW_EVENTS.length; i++) {
      document.removeEventListener(SWALLOW_EVENTS[i], swallowEvent, true);
    }
    hideHover();
    closePopover();
  }

  // 截图前隐藏悬停框/输入框（保留气泡）
  function hideOverlay() {
    hideHover();
    closePopover();
  }

  function getPayload() {
    return {
      annotations: annotations,
      meta: {
        pageUrl: location.href,
        viewport: window.innerWidth + 'x' + window.innerHeight
      }
    };
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg || !msg.type) return;
    switch (msg.type) {
      case 'WA_TOGGLE':
        // 快捷键 Ctrl+.：以当前 active 状态为准切换（开↔关）。
        // 关→开：进入标注；开→关：退出并重新打开插件 UI，方便查看已捕获的标注。
        if (active) {
          stop();
          safeSend({ type: 'WA_ANNO_STOPPED' });
          openPopup();
        } else {
          start();
          safeSend({ type: 'WA_ANNO_STARTED' });
        }
        sendResponse({ ok: true, active: active });
        break;
      case 'WA_START':
        start();
        sendResponse({ ok: true });
        break;
      case 'WA_STOP':
        stop();
        sendResponse({ ok: true });
        break;
      case 'WA_HIDE_OVERLAY':
        hideOverlay();
        sendResponse({ ok: true });
        break;
      case 'WA_CLEAR':
        sendResponse(clearAll());
        break;
      case 'WA_LANG':
        if (WA.set) WA.set(msg.lang); // 弹窗切换语言后同步到当前页内容脚本
        sendResponse({ ok: true, lang: WA.get() });
        break;
      case 'WA_UPDATE':
        // 更新某条标注的说明文字（popup 内编辑后回写）
        {
          const a = annotations.find(function (x) { return x.index === msg.index; });
          if (a) {
            a.note = msg.note;
            notifyCount();
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'not found' });
          }
        }
        break;
      case 'WA_DELETE':
        // 删除某条标注：同步移除内存数据与其气泡/区域边框覆盖层
        {
          const i = annotations.findIndex(function (x) { return x.index === msg.index; });
          if (i >= 0) {
            annotations.splice(i, 1);
            const oi = overlays.findIndex(function (o) { return o.idx === msg.index; });
            if (oi >= 0) {
              const rec = overlays[oi];
              if (rec.bubble) rec.bubble.remove();
              if (rec.region) rec.region.remove();
              overlays.splice(oi, 1);
            }
            notifyCount();
            sendResponse({ ok: true });
          } else {
            sendResponse({ ok: false, error: 'not found' });
          }
        }
        break;
      case 'WA_GET':
        sendResponse(getPayload());
        break;
      default:
        break;
    }
    return true;
  });
})();
