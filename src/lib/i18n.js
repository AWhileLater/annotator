/* ===== Web Annotator 多语言（中英双语，运行时切换） =====
 * 浏览器中挂在 window.WA；Node 中不加载（无 chrome）。
 * 默认跟随浏览器语言；用户手动选择后持久化到 chrome.storage.local.wa_lang。
 */
(function (root) {
  'use strict';

  const DICT = {
    zh: {
      start: '开始标注',
      stop: '结束标注',
      clear: '清除标注',
      copy: '提示词+截图',
      copyTitle: '复制为提示词（文本 + 截图）：文本与截图一并复制到剪贴板',
      copyText: '复制提示词',
      copyTextTitle: '单纯复制提示词：只复制结构化提示词文本，不含截图（最稳，绕开"浏览器不支持复制图片"）',
      copyShot: '复制截图',
      copyShotTitle: '仅复制截图：只复制气泡截图，不含文本',
      settingsTitle: '设置',
      themeLabel: '主题',
      themeSystem: '跟随系统',
      themeLightOpt: '明亮',
      themeDarkOpt: '夜间',
      langLabel: '语言',
      modeAnnotation: '标注',
      modePrompt: '提示词',
      previewPlaceholder: '标注文本预览将显示在这里…',
      statusAnnotating: '标注中：点击页面元素添加气泡',
      statusEnded: '已结束标注',
      statusNotStarted: '未开始',
      statusCleared: '已清除所有标注',
      statusAutoEnded: '已自动结束（点「开始标注」继续）',
      statusStopped: '已停止标注（点「开始标注」继续）',
      statusCopied: '已复制（结构化文本 + 带气泡截图，{n} 条标注）',
      statusCopiedText: '已复制提示词（仅文本，{n} 条标注）',
      statusCopiedShot: '已复制截图',
      errNoTab: '没有活动标签页',
      errNotInjected: '内容脚本未注入（可能是受限页面）',
      errFetchFail: '获取失败',
      errScreenshotFail: '截图失败',
      errClipboardBlocked: '剪贴板图片被拦截：已复制文本并下载 PNG 兜底',
      popoverPlaceholder: '输入这条标注的说明…',
      cancel: '取消',
      save: '保存',
      annoListEmpty: '暂无标注',
      edit: '编辑',
      delete: '删除',
      annoDeleted: '已删除标注 {n}',
      annoUpdated: '已更新标注 {n}',
      shotEdgeLabel: '截图缩放,最长边',
      shortcutLabel: '标注快捷键:',
      shortcutConfig: '配置快捷键',
      shortcutConfigTitle: '在浏览器扩展设置页管理快捷键（Ctrl+. 切换标注开/关）',
      shortcutNotSet: '未设置',
      sponsorLink: '在 Ko-fi 上赞助',
      sponsorPrompt: '如果 Annotator 帮你节省了时间，你可以支持它的持续发展：',
      versionLabel: '版本'
    },
    en: {
      start: 'Start',
      stop: 'Stop',
      clear: 'Clear',
      copy: 'Prompt+shot',
      copyTitle: 'Copy as prompt (text + screenshot): both text and screenshot go to the clipboard',
      copyText: 'Copy prompt',
      copyTextTitle: 'Copy prompt text only: prompt text, no screenshot (most reliable; bypasses "browser cannot copy images")',
      copyShot: 'Copy shot',
      copyShotTitle: 'Copy screenshot only: bubble screenshot, no text',
      settingsTitle: 'Settings',
      themeLabel: 'Theme',
      themeSystem: 'System',
      themeLightOpt: 'Light',
      themeDarkOpt: 'Dark',
      langLabel: 'Language',
      modeAnnotation: 'annotation',
      modePrompt: 'prompt',
      previewPlaceholder: 'Annotation text preview will show here…',
      statusAnnotating: 'Annotating: click a page element to add a bubble',
      statusEnded: 'Annotation ended',
      statusNotStarted: 'Not started',
      statusCleared: 'All annotations cleared',
      statusAutoEnded: 'Auto-ended (click "Start" to continue)',
      statusStopped: 'Stopped (click "Start" to continue)',
      statusCopied: 'Copied (prompt text + bubble screenshot, {n} annotation(s))',
      statusCopiedText: 'Copied prompt (text only, {n} annotation(s))',
      statusCopiedShot: 'Screenshot copied',
      errNoTab: 'No active tab',
      errNotInjected: 'Content script not injected (possibly a restricted page)',
      errFetchFail: 'Failed to fetch',
      errScreenshotFail: 'Screenshot failed',
      errClipboardBlocked: 'Clipboard image blocked: copied text and downloaded PNG as fallback',
      popoverPlaceholder: 'Enter a comment for this annotation…',
      cancel: 'Cancel',
      save: 'Save',
      annoListEmpty: 'No annotations yet',
      edit: 'Edit',
      delete: 'Delete',
      annoDeleted: 'Annotation {n} deleted',
      annoUpdated: 'Annotation {n} updated',
      shotEdgeLabel: 'Screenshot scale, max edge',
      shortcutLabel: 'Shortcut:',
      shortcutConfig: 'Configure',
      shortcutConfigTitle: 'Manage shortcuts in the browser extensions settings page (Ctrl+. toggles annotation on/off)',
      shortcutNotSet: 'Not set',
      sponsorLink: 'Support on Ko-fi',
      sponsorPrompt: 'If Annotator saves you time, you can support its development:',
      versionLabel: 'Version'
    }
  };

  // 初始化时跟随浏览器语言，无持久化偏好时使用
  let current = detectBrowserLang();

  function load(cb) {
    try {
      chrome.storage.local.get('wa_lang', function (r) {
        if (r && r.wa_lang && DICT[r.wa_lang]) current = r.wa_lang;
        else current = detectBrowserLang();
        if (cb) cb(current);
      });
    } catch (e) {
      current = detectBrowserLang();
      if (cb) cb(current);
    }
  }

  // 设置语言并持久化（content script 调用时也会写回 storage，幂等）
  function set(lang, cb) {
    if (!DICT[lang]) lang = 'zh';
    current = lang;
    try {
      chrome.storage.local.set({ wa_lang: lang }, function () {
        if (cb) cb(lang);
      });
    } catch (e) {
      if (cb) cb(lang);
    }
  }

  function get() { return current; }

  function t(key, params) {
    let s;
    if (DICT[current] && DICT[current][key] != null) s = DICT[current][key];
    else if (DICT.en[key] != null) s = DICT.en[key];
    else s = key;
    if (params) {
      for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    }
    return s;
  }

  // 检测浏览器语言：中文系统 → 'zh'，其余 → 'en'
  function detectBrowserLang() {
    try {
      const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (navLang.startsWith('zh')) return 'zh';
    } catch (e) {}
    return 'en';
  }

  const api = { DICT: DICT, load: load, set: set, get: get, t: t };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.WA = api;
  }
})(typeof window !== 'undefined' ? window : this);

