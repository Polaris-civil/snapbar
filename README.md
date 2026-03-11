# SnapBar

![SnapBar Logo](public/snapbar.svg)

SnapBar 是一个基于 `Tauri + React + TypeScript` 构建的 Windows 桌面效率工具，用来管理和快速输入常用提示词、模板文本、代码片段和固定回复。

它的核心思路不是“复制后自己粘贴”，而是点击按钮或触发快捷键后，自动把内容输入到你刚刚正在使用的应用里，尽量减少在不同窗口之间来回切换的打断感。

## 功能特性

- 悬浮提示词条，常驻桌面顶部，适合高频使用
- 点击按钮后自动向当前目标应用输入文本
- 支持为提示词设置自定义快捷键
- 支持按分类管理提示词
- 支持新增、编辑、删除提示词
- 支持本地加密存储
- 支持 JSON 备份与恢复
- 支持 TXT 导入与导出
- 支持调节按钮大小、主题颜色，并提供可视化预览

## 适用场景

- AI 提示词快速调用
- 邮件模板和固定回复复用
- 常用命令、代码片段快速输入
- 客服、运营、开发等高频文本输入场景

## 技术栈

- 前端：React 19、TypeScript、Vite
- 桌面端：Tauri 2、Rust
- UI：Tailwind CSS、Lucide Icons
- 测试：Vitest、Testing Library

## 运行环境

- Windows 10 / 11
- Node.js 18+
- Rust stable

说明：当前实现更偏向 Windows 桌面环境，核心输入和窗口控制能力依赖 Windows 原生行为。

## 本地开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run tauri dev
```

如果你在 PowerShell 下遇到脚本执行策略问题，可以改用：

```bat
cmd /c npm install
cmd /c npm run tauri dev
```

## 打包发布

构建安装包：

```bash
npm run tauri build
```

构建完成后，Windows 安装包通常位于：

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

## 项目结构

```text
src/
  components/        弹窗组件
  hooks/             业务状态管理
  lib/               存储、加密、导入导出等能力
  routes/            主界面

src-tauri/
  src/               Rust 原生层
  icons/             应用图标资源
  tauri.conf.json    Tauri 配置
```

## 主要交互

- 点击提示词按钮：向目标应用输入文本
- 点击 `+`：新建提示词
- 点击设置：打开应用设置
- 编辑按钮：修改提示词
- 删除按钮：删除提示词
- 最小化按钮：最小化主窗口

## 数据说明

- 提示词和设置默认保存在本地
- 可通过密码启用本地加密保护
- 可导出为 JSON 备份，也可导出为 TXT 进行分享或迁移

## 已知说明

- 某些软件、输入法或高权限窗口下，模拟输入行为可能受系统限制
- 全局快捷键如果与系统或其他软件冲突，会注册失败
- 首次安装后如果桌面快捷方式图标未立即刷新，通常是 Windows 图标缓存导致

## License

MIT
