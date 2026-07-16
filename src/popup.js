/* ===== Web Annotator 弹出面板逻辑 ===== */
'use strict';

// MV3 健壮性：拦截任何未处理的 Promise 拒绝（典型为 service worker 唤醒竞态导致的
// “Receiving end does not exist”），避免它在控制台以 “Uncaught (in promise)” 刷屏。
// 业务层已用 .catch 做优雅降级，这里只作为最终兜底。
window.addEventListener('unhandledrejection', function (e) {
  const m = (e.reason && (e.reason.message || String(e.reason))) || '';
  if (/Receiving end does not exist|Could not establish connection/i.test(m)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

// 保活端口：打开 popup 时与 service worker 建立长连接，使其在 popup 期间保持存活，
// 从根上消除 “popup 打开瞬间 SW 尚未唤醒” 的竞态。popup 关闭后端口断开，SW 正常回收。
try { chrome.runtime.connect(); } catch (e) {}

const $ = (id) => document.getElementById(id);
const F = window.AnnoFormat || {};
const WA = window.WA || { t: (k) => k, get: () => 'zh', load: (cb) => cb && cb('zh'), set: (l, cb) => cb && cb(l) };

// ===== 设置页外链地址 =====
// 点「版本」跳转，用于查看源码 / 更新日志
const REPO_URL = 'https://github.com/AWhileLater/annotator';
// 点「赞助」跳转的 Ko-fi 赞助页
const SPONSOR_URL = 'https://ko-fi.com/awhilelaterstudio';

function activeTab() {
  return new Promise((res) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => res(tabs[0] || null));
  });
}

async function sendToContent(msg) {
  const tab = await activeTab();
  if (!tab) return { ok: false, error: WA.t('errNoTab') };
  const payload = typeof msg === 'string' ? { type: msg } : msg;
  return new Promise((res) => {
    chrome.tabs.sendMessage(tab.id, payload, (r) => {
      if (chrome.runtime.lastError) res({ ok: false, error: WA.t('errNotInjected') });
      else res(r || { ok: true });
    });
  });
}

function setErr(m) { $('err').textContent = m || ''; }
// kind='ok' 时给状态文字加绿色强调（复制成功）；其余消息不加
function setStatus(m, kind) {
  const el = $('status');
  el.textContent = m;
  if (kind === 'ok') el.classList.add('ok');
  else el.classList.remove('ok');
}

function currentMode() {
  return document.querySelector('input[name="mode"]:checked').value;
}

// 把所有带 data-i18n / data-i18n-ph 的元素填成当前语言；并刷新切换按钮与 <html lang>
function applyI18n() {
  const lang = WA.get();
  document.documentElement.lang = lang === 'zh' ? 'zh' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = WA.t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.setAttribute('placeholder', WA.t(el.getAttribute('data-i18n-ph')));
  });
  // 悬停提示（title）也跟随语言切换
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', WA.t(el.getAttribute('data-i18n-title')));
  });
  applyThemeUI(); // 主题选择项也跟随语言（选项文案）
}

// 实时刷新预览（不复制，仅方便调试查看当前标注数据）
async function renderPreview(announce) {
  const r = await new Promise((res) => {
    chrome.runtime.sendMessage({ type: 'WA_GET_ANNOTATIONS' }, res);
  });
  if (!r || !r.ok) {
    $('preview').style.display = 'none';
    setErr(r.errorKey ? WA.t(r.errorKey) : (r.error || WA.t('errFetchFail')));
    return null;
  }
  const mode = currentMode();
  const isSimple = mode === 'simple';
  if (!isSimple) {
    // 仅在「提示词」模式显示文本预览；标注模式只靠下方序号+标注列表。
    // 预览显示完整提示词（与复制内容完全一致，包含固定指令前缀 + 所有标注）。
    const text = F.formatAnnotations(r.payload.annotations, { mode: 'prompt', meta: r.payload.meta, lang: WA.get() });
    $('preview').value = text;
    $('preview').style.display = '';
  } else {
    $('preview').style.display = 'none';
  }
  renderList(r.payload); // 同步渲染可编辑标注列表（序号 + 标注 + 编辑/删除）
  // 调试日志：在页面 DevTools Console 也能看到原始 payload
  console.log('[WebAnnotator] payload', r.payload);
  return r.payload;
}

// 渲染可编辑标注列表：每条显示序号 + 说明 + 编辑/删除按钮。
// 说明用 textContent 写入（避免 note 中的 HTML 被注入）。
function renderList(payload) {
  const wrap = $('annoList');
  if (!wrap) return;
  const anns = (payload && payload.annotations) || [];
  if (anns.length === 0) {
    wrap.innerHTML = '<p class="anno-empty">' + WA.t('annoListEmpty') + '</p>';
    return;
  }
  const sorted = anns.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
  wrap.innerHTML = sorted
    .map(function (a) {
      return (
        '<div class="anno-item" data-idx="' + a.index + '">' +
        '<span class="anno-idx">' + a.index + '</span>' +
        '<span class="anno-note"></span>' +
        '<span class="anno-actions">' +
        '<button class="anno-edit" data-act="edit">' + WA.t('edit') + '</button>' +
        '<button class="anno-del" data-act="delete">' + WA.t('delete') + '</button>' +
        '</span></div>'
      );
    })
    .join('');
  // 单独回填说明文字，防止 HTML 注入
  wrap.querySelectorAll('.anno-item').forEach(function (it) {
    const idx = it.getAttribute('data-idx');
    const a = sorted.find(function (x) { return String(x.index) === String(idx); });
    it.querySelector('.anno-note').textContent = (a && a.note) || '';
  });
}

// 在列表项内联进入编辑态：用 textarea 替换说明，提供保存/取消
function startEdit(item, idx) {
  const noteEl = item.querySelector('.anno-note');
  const current = noteEl ? noteEl.textContent : '';
  item.classList.add('editing');
  item.innerHTML =
    '<textarea class="anno-edit-box"></textarea>' +
    '<div class="anno-edit-actions">' +
    '<button class="anno-save">' + WA.t('save') + '</button>' +
    '<button class="anno-cancel">' + WA.t('cancel') + '</button>' +
    '</div>';
  const tx = item.querySelector('.anno-edit-box');
  tx.value = current;
  tx.focus();
  item.querySelector('.anno-cancel').addEventListener('click', function () {
    renderPreview(false);
  });
  item.querySelector('.anno-save').addEventListener('click', function () {
    const v = tx.value.trim();
    if (!v) { renderPreview(false); return; }
    // 写回语言跟随当前选择
    sendToContent({ type: 'WA_UPDATE', index: idx, note: v, lang: WA.get() }).then(function (r) {
      if (r && r.ok) {
        setStatus(WA.t('annoUpdated', { n: idx }), 'ok');
        renderPreview(false);
      } else {
        setErr((r && r.error) || WA.t('errFetchFail'));
      }
    });
  });
}

// 标注列表交互（事件委托）：编辑 / 删除
$('annoList').addEventListener('click', function (e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const item = btn.closest('.anno-item');
  if (!item) return;
  const idx = Number(item.getAttribute('data-idx'));
  const act = btn.getAttribute('data-act');
  if (act === 'delete') {
    sendToContent({ type: 'WA_DELETE', index: idx }).then(function (r) {
      if (r && r.ok) {
        setStatus(WA.t('annoDeleted', { n: idx }), 'ok');
        renderPreview(false);
      } else {
        setErr((r && r.error) || WA.t('errFetchFail'));
      }
    });
  } else if (act === 'edit') {
    startEdit(item, idx);
  }
});

// 模式切换高亮兜底：用 .active 类保证选中态高亮（即便 :has() 不被支持也生效）
function syncModeTabs() {
  document.querySelectorAll('.mode label').forEach((lbl) => {
    const input = lbl.querySelector('input[type="radio"]');
    lbl.classList.toggle('active', !!(input && input.checked));
  });
}

// 切换模式即刷新预览
document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => { syncModeTabs(); renderPreview(false); });
});

// 语言切换：持久化 + 刷新本弹窗 + 通知已打开的内容脚本
function setLanguage(next) {
  WA.set(next, () => {
    applyI18n();
    renderPreview(false);
    chrome.tabs.query({}, (tabs) => {
      (tabs || []).forEach((t) => {
        chrome.tabs.sendMessage(t.id, { type: 'WA_LANG', lang: next }).catch(function () {});
      });
    });
  });
}
$('langSel').addEventListener('change', () => setLanguage($('langSel').value));

// 配置界面：点击右上角齿轮进入，点击返回箭头回到主视图
function showSettings() {
  $('mainView').classList.add('hidden');
  $('settingsView').classList.remove('hidden');
  initShortcut(); // 每次打开设置都刷新实际绑定的快捷键
  initLinks();    // 刷新版本号与外链地址
}
function hideSettings() {
  $('settingsView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
  renderPreview(false); // 回到主视图时刷新列表/预览
}
$('settings').addEventListener('click', showSettings);
$('settingsBack').addEventListener('click', hideSettings);

// 跳转到浏览器扩展快捷键设置页：按 UA 区分 Chrome / Edge，使用各自协议头。
// 具体按键在该页由用户重绑（manifest.commands 仅提供默认值 Ctrl+.）。
function openShortcutSettings() {
  const ua = navigator.userAgent || '';
  const isEdge = /Edg\//.test(ua);
  const url = isEdge ? 'edge://extensions/shortcuts' : 'chrome://extensions/shortcuts';
  const fallback = isEdge ? 'edge://extensions' : 'chrome://extensions';
  chrome.tabs.create({ url: url }, function () {
    // 极少数环境禁止直接打开 shortcuts 子页时，退而打开扩展管理页（用户可手动进入快捷键）
    if (chrome.runtime.lastError) chrome.tabs.create({ url: fallback });
  });
}
$('openShortcuts').addEventListener('click', openShortcutSettings);

// 读取用户实际绑定的快捷键并显示在设置页（而非写死“Ctrl+.”）。
// Chrome 返回形如 "Ctrl+Period"，把按键 token 转成更直观的符号（. , 等）。
function formatShortcut(s) {
  if (!s) return '';
  return s
    .replace(/\bPeriod\b/g, '.')
    .replace(/\bComma\b/g, ',')
    .replace(/\bSpace\b/g, 'Space');
}
function initShortcut() {
  const el = $('shortcutKey');
  if (!el) return;
  if (!chrome.commands || !chrome.commands.getAll) {
    el.textContent = 'Ctrl+.';
    return;
  }
  chrome.commands.getAll(function (cmds) {
    const c = (cmds || []).find(function (x) { return x.name === 'start-annotation'; });
    el.textContent = (c && c.shortcut) ? formatShortcut(c.shortcut) : WA.t('shortcutNotSet');
  });
}

// 设置页底部外链：版本号（取自 manifest，点击跳 GitHub）+ Ko-fi 赞助
function initLinks() {
  const v = $('versionLink');
  if (v) {
    const ver = ((chrome.runtime.getManifest && chrome.runtime.getManifest()) || {}).version || '0.0.0';
    v.textContent = 'v' + ver;
    v.href = REPO_URL;
  }
  const b = $('kofiLink');
  if (b) b.href = SPONSOR_URL;
}

// 主题（明亮/夜间/跟随系统）：data-theme 挂在 <html> 上；null = 跟随系统，'light'/'dark' = 手动。
let themeMode = null;
function applyThemeUI() {
  const sel = $('themeSel');
  if (sel) sel.value = themeMode || 'system';
  if (themeMode) document.documentElement.setAttribute('data-theme', themeMode);
  else document.documentElement.removeAttribute('data-theme'); // 未手动选择 → 交给系统媒体查询
}
function initTheme() {
  chrome.storage.local.get('wa_theme', (o) => {
    const v = o && o.wa_theme;
    themeMode = (v === 'light' || v === 'dark') ? v : null;
    applyThemeUI();
  });
}
$('themeSel').addEventListener('change', () => {
  const v = $('themeSel').value;
  themeMode = (v === 'light' || v === 'dark') ? v : null;
  chrome.storage.local.set({ wa_theme: v }); // 存 'system'/'light'/'dark'
  applyThemeUI();
});

// ESC 在 popup 聚焦时：主动停止标注。浏览器默认会把 popup 关掉，但标注状态会被
// 正确终止（content script 收到 WA_STOP）——解决“按 ESC 只关了 UI 却没停标注”的问题。
// 尝试 preventDefault 以尽量保留 popup；即便浏览器仍关掉 popup，标注也已停止。
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.keyCode === 27) {
    try { e.preventDefault(); } catch (_) {}
    sendToContent('WA_STOP').then(() => setStatus(WA.t('statusEnded')));
  }
});

$('start').addEventListener('click', async () => {
  setErr('');
  const r = await sendToContent('WA_START');
  if (r.ok) {
    setStatus(WA.t('statusAnnotating'));
    window.close(); // 开始标注后隐藏插件 UI，避免遮挡页面
  } else setErr(r.error);
});

$('stop').addEventListener('click', async () => {
  setErr('');
  const r = await sendToContent('WA_STOP');
  setStatus(r.ok ? WA.t('statusEnded') : WA.t('statusNotStarted'));
});

$('clear').addEventListener('click', async () => {
  setErr('');
  const r = await sendToContent('WA_CLEAR');
  if (r.ok) {
    setStatus(WA.t('statusCleared'));
    renderPreview(false); // 预览同步清空
  } else setErr(r.error);
});

$('copy').addEventListener('click', async () => {
  setErr('');
  const payload = await renderPreview(false);
  if (!payload) return;
  // 复制时强制使用结构化（prompt）文本，不受预览模式影响；语言跟随当前选择
  const text = F.formatAnnotations(payload.annotations, { mode: 'prompt', meta: payload.meta, lang: WA.get() });
  const r = await capture();
  if (!r || !r.ok) { setErr(r ? r.error : WA.t('errScreenshotFail')); return; }
  const imgBlob = dataUrlToBlob(r.dataUrl);
  const textBlob = new Blob([text], { type: 'text/plain' });
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/plain': textBlob, 'image/png': imgBlob })
    ]);
    setStatus(WA.t('statusCopied', { n: payload.annotations.length }), 'ok');
  } catch (e) {
    // 降级：仅复制文本 + 下载 PNG 兜底（部分应用/环境拦截图片写入）
    try { await navigator.clipboard.writeText(text); } catch (_) {}
    download(r.dataUrl);
    setErr(WA.t('errClipboardBlocked'));
  }
});

// 单纯复制提示词（纯文本，不碰截图）：最可靠的复制方式，完全绕开「浏览器不支持
// 复制图片」的问题——任何支持文本粘贴的 agent 输入框都能直接接收。
$('copyText').addEventListener('click', async () => {
  setErr('');
  const payload = await renderPreview(false);
  if (!payload) return;
  // 复制时强制使用结构化（prompt）文本，不受预览模式影响；语言跟随当前选择
  const text = F.formatAnnotations(payload.annotations, { mode: 'prompt', meta: payload.meta, lang: WA.get() });
  try {
    await navigator.clipboard.writeText(text);
    setStatus(WA.t('statusCopiedText', { n: payload.annotations.length }), 'ok');
  } catch (e) {
    setErr(WA.t('errClipboardBlocked'));
  }
});

async function capture() {
  return new Promise((res) => {
    chrome.runtime.sendMessage({ type: 'WA_CAPTURE' }, res);
  });
}

// 仅复制截图：部分 agent 输入框不支持「文本 + 图片」同粘，提供一个只复制图片的出口。
// 图片被拦截时降级为下载 PNG，保证用户至少能拿到图。
$('copyShot').addEventListener('click', async () => {
  setErr('');
  const r = await capture();
  if (!r || !r.ok) { setErr(r ? r.error : WA.t('errScreenshotFail')); return; }
  const imgBlob = dataUrlToBlob(r.dataUrl);
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': imgBlob })]);
    setStatus(WA.t('statusCopiedShot'), 'ok');
  } catch (e) {
    download(r.dataUrl);
    setErr(WA.t('errClipboardBlocked'));
  }
});

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function download(dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = 'web-annotation-' + Date.now() + '.png';
  a.click();
}

// 标注完成 / 清除后，内容脚本会发 ANNO_COUNT，实时刷新预览（无需手动切模式）
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === 'ANNO_COUNT') {
    renderPreview(false);
  } else if (msg.type === 'WA_MODE_ENDED') {
    setStatus(WA.t('statusAutoEnded'));
  } else if (msg.type === 'WA_ANNO_STARTED') {
    setStatus(WA.t('statusAnnotating'));
  } else if (msg.type === 'WA_ANNO_STOPPED') {
    setStatus(WA.t('statusStopped'));
  }
});

// 截图最长边设置：读取 storage 填充下拉，变更时持久化（background 截图时读取）
function initShotEdge() {
  const sel = $('shotEdge');
  if (!sel) return;
  chrome.storage.local.get('wa_shotMaxEdge', (o) => {
    sel.value = (o && o.wa_shotMaxEdge) || '1024';
  });
  sel.addEventListener('change', () => {
    chrome.storage.local.set({ wa_shotMaxEdge: sel.value });
  });
}

// 弹窗打开时先加载语言 → 应用文案 → 渲染一次已有标注
WA.load(() => {
  applyI18n();
  syncModeTabs();
  const ls = $('langSel');
  if (ls) ls.value = WA.get();
  initShotEdge();
  initTheme();
  initShortcut();
  initLinks();
  renderPreview(false);
});
