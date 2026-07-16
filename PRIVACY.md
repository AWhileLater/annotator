# Privacy Policy / 隐私政策

**Annotator** respects your privacy. This policy explains how the extension handles your data.
（**Annotator**（以下简称"本扩展"）尊重并保护您的隐私。本政策说明本扩展如何处理您的数据。）

## Data we collect / 我们收集的数据

This extension **does not collect, transmit, or upload** any personal data or annotation content to any remote server.
（本扩展**不收集、不传输、不上传**任何个人数据或标注内容到任何远程服务器。）

## Where data is stored / 数据存储位置

All annotation records, screenshot settings, and UI preferences (theme, language, screenshot max-edge) are stored **locally** in your browser's `chrome.storage.local` — entirely on your device, accessible only by this extension, and never sent to any external service.
（所有标注记录、截图设置与界面偏好（主题、语言、截图最长边）仅保存在您本地浏览器的 `chrome.storage.local` 中，完全位于您的设备之上，仅本扩展可读写，不会被发送到任何外部服务。）

## Permissions / 权限说明

- `activeTab` / `scripting`：Used to inject the content script into the page you actively choose to annotate for element highlighting and annotation. （用于在您主动触发标注的页面注入内容脚本，实现元素高亮与标注。）
- `storage`：Used to save settings and annotations locally. （用于在本机保存上述设置与标注。）
- `clipboardWrite`：Used to copy the prompt text and/or screenshot to the system clipboard when you click "Copy". （用于您点击"复制"时把提示词 / 截图写入系统剪贴板。）
- `host_permissions` (`<all_urls>`)：Required so you can annotate any page you visit; the extension never reads page content in the background. （用于在您选择标注的任意页面注入脚本；扩展不会在后台自动读取页面内容。）

## Contact / 联系

For questions, reach out via the GitHub repository.
（如有疑问，请通过项目的 GitHub 仓库联系作者。）
