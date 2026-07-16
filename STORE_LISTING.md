# Annotator — Chrome Web Store 上架文案（清单）

> 本文件供你在 Chrome 开发者后台（Chrome Web Store Developer Dashboard）填写使用。
> 代码内的 `manifest.json` 已含英文 `description` 与 `category`；下方「详细描述」分中英文两版，
> 英文版直接对应商店默认语言，中文版在后台「添加语言 → 中文 (简体)」处粘贴。

---

## 1. 简短描述 / Short description（≤132 字符）

- **EN**: `Annotate web elements, capture screenshots, and copy structured prompts for AI coding assistants in one click.`
- **ZH**: `标注网页元素、截取画面、一键复制给 AI 编程助手用的结构化提示词。`

---

## 2. 详细描述（English）

Annotator helps you capture precise annotations on any web page and turn them into ready-to-use prompts for AI coding assistants (e.g. Codex / Claude).

**Features**
- Hover to highlight any element; click to drop a numbered bubble annotation
- Each annotation records the element's CSS selector, DOM path, visible text, and click position
- Annotations follow page scroll/resize and reposition automatically
- A single annotation auto-ends and refreshes the popup
- Three copy modes: prompt + screenshot / prompt text only / screenshot only
- Two views: Annotations (edit / delete inline) and Prompt (structured preview)
- Settings: theme (system / light / dark), language (中文 / English), screenshot max-edge scaling
- Global hotkey `Ctrl+.` toggles annotation on/off; rebind in the browser's shortcut settings
- Bilingual UI (中文 / English)

**How it works**
The generated prompt clearly separates trusted instructions (TRUST RULES / EXECUTION RULES) from page-locating data (selector / domPath / text / pos), so the AI agent applies your edits to the right element. A fallback NOTE tells the agent to locate by selector / path / text when the screenshot is unavailable.

**Privacy**
All annotations and settings are stored locally in your browser (`chrome.storage.local`). No data is uploaded to any server. The extension only injects a content script into the pages you choose to annotate.

---

## 3. 详细描述（中文）

Annotator 帮助你在任意网页上做精确标注，并一键生成可直接给 AI 编程助手（如 Codex / Claude）使用的结构化提示词。

**功能特性**
- 悬停高亮任意元素，点击即可落下带编号的气泡标注
- 每条标注自动记录元素的 CSS selector、DOM 路径、可见文本与点击坐标
- 标注随页面滚动 / 缩放自动重定位
- 单次标注自动结束并刷新弹窗
- 三种复制方式：提示词 + 截图 / 仅提示词 / 仅截图
- 两种视图：标注（可内联编辑 / 删除）、提示词（结构化预览）
- 设置项：主题（跟随系统 / 明亮 / 夜间）、语言（中文 / English）、截图最长边缩放
- 全局快捷键 `Ctrl+.` 切换标注开关；可在浏览器快捷键设置中重绑
- 中英双语界面

**工作原理**
生成的提示词明确区分「可信指令」（TRUST RULES / EXECUTION RULES）与「仅用于定位的页面数据」（selector / domPath / text / pos），让 AI 智能体把你的修改应用到正确元素。并附带兜底说明：截图不可用时，依据 selector / path / text 定位。

**隐私**
所有标注与设置仅保存在你的浏览器本地（`chrome.storage.local`），不上传到任何服务器。扩展只在你选择标注的页面注入内容脚本。

---

## 4. 关键词 / Keywords

`web annotation`, `screenshot`, `prompt`, `CSS selector`, `DOM path`, `AI coding`, `Codex`, `Claude`, `developer tools`, `网页标注`, `截图`, `提示词`, `前端标注`

---

## 5. 后台填写提示

| 项目 | 建议值 |
|---|---|
| 类别 Category | **Developer Tools** |
| 默认语言 | English（描述取自 manifest / 上方英文版） |
| 额外语言 | 中文 (简体) → 粘贴上方「详细描述（中文）」 |
| 截图 | 至少 1 张，尺寸 **1280×800** 或 640×400 |
| 小图标 | 使用 `src/icons/icon128.png`（同扩展图标） |
| 宣传图（可选） | 440×280 或 920×680 |
| 隐私政策 | 已附 `PRIVACY.md`（中英），托管到公开可访问 URL（如 GitHub raw / Pages）后填入链接 |

> 注：扩展图标当前为临时占位图（字母 W），后续可替换为正式设计；替换后保持 `src/icons/icon{16,48,128}.png` 文件名即可，无需改 manifest。
