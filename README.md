# Annotator — 网页元素标注 + 截图扩展

Manifest V3，Chrome / Edge 可用。悬停高亮元素 → 点击添加序号气泡 → 写备注 → 一键复制结构化提示词文本 + 带气泡截图。

> 本扩展不内置任何 LLM。它把标注整理成结构化文本 + 截图的格式，方便粘贴给 AI 编程工具使用。

## 功能

- **悬停高亮 + 选择器预览**：标注模式下鼠标跟随元素，红色高亮边框 + 显示 CSS selector
- **点击即标注**：写备注 → 生成带序号气泡 + 元素区域边框
- **标注跟随页面**：气泡随元素重定位，滚动缩放自动跟随
- **三种复制出口**：提示词+截图 / 纯提示词 / 纯截图
- **三种预览模式**：标注列表（可编辑/删除）/ 提示词预览 / 原始 JSON
- **中英双语** + **主题**（跟随系统/明亮/夜间）

## 加载（解压版）

1. Chrome/Edge 打开 `chrome://extensions`
2. 开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `src/` 目录
4. 固定扩展图标到工具栏

## 使用流程

1. 点工具栏图标 → 弹窗点「开始标注」
2. 悬停元素 → 红色高亮 + 选择器预览
3. 点元素 → 写备注 → 保存生成序号气泡
4. 在弹窗中预览或复制结果
5. 按 `ESC` 随时退出标注模式

## 目录结构

```
src/
├── manifest.json       MV3 配置
├── content.js          标注引擎：悬停、气泡、坐标、主题
├── content.css         注入样式（含主题变量）
├── background.js       Service Worker：消息路由 + 截图
├── popup.html          控制面板
├── popup.js            弹窗逻辑
├── popup.css           弹窗样式
└── lib/
    ├── i18n.js         中英双语字典
    └── format.js       格式化 / selector / domPath 纯函数
dist/
├── annotator.crx   打包的扩展
└── annotator.pem   签名私钥
pack.js                 打包脚本
```

## 打包

```bash
npm install -g crx
node pack.js
```

输出到 `dist/annotator.crx`。

## 发布到 Chrome Web Store

1. **生成发布包**：`python pack-zip.py` → 产出 `dist/annotator.zip`（manifest.json 位于 zip 顶层）。商店只接受 zip，**不要上传 .crx**。
2. 到 [Chrome Web Store 开发者后台](https://chrome.google.com/webstore/devconsole/) 点 **New Item**，上传 `dist/annotator.zip`。
3. 填写商品详情（文案见 `STORE_LISTING.md`）：
   - 名称：`Annotator: annotation prompts for AI coding`
   - 简短描述（≤132 字符）、详细描述（中英双语）
   - 类别：**Developer Tools**；默认语言 English，额外添加 中文(简体)
   - 上传至少 1 张 **1280×800** 截图、小图标用 `src/icons/icon128.png`
4. **隐私与安全**：本扩展数据全存本地 `chrome.storage.local`、不上传，按 `PRIVACY.md` 声明；把 `PRIVACY.md` 托管到公开 URL 后填入「隐私政策」链接。
5. 提交审核；通过后点 **Publish**。

## 协议

MIT
