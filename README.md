# niconico-app

基于 Tauri + Rust 的本地谱面批量下载工具。

## 已实现功能

- 内置 `collections` 清单目录（35 份 `manifest.json`）
- 支持勾选多个清单并按 ID 去重下载
- 下载选项：
  - `下载不包含 BGA`（`nobga`）
  - `输出格式`（`.adx` / `.zip`）
- 下载完成后可选自动整合为单 `.adx`：
  - 仅处理本次新下载文件
- 任务状态：启动、进度、日志、失败项、取消
- 支持手动刷新外部 `collections` 目录（运行时 overlay）

## 技术栈

- Frontend: React + Vite + TypeScript
- Backend: Rust + Tauri

## 开发运行

```bash
npm install --include=dev
npm run tauri dev
```

## 生产构建

```bash
npm run build
cd src-tauri && cargo check
```

## 关键接口（Tauri commands）

- `list_builtin_collections`
- `refresh_collections_from_dir`
- `start_download_task`
- `cancel_task`
- `get_task_state`

## 目录结构

- `collections/`：内置 manifest 快照
- `src/`：前端 UI
- `src-tauri/src/collections.rs`：manifest 解析与清单加载
- `src-tauri/src/downloader.rs`：下载任务与鉴权流程
- `src-tauri/src/bundler.rs`：自动整合
- `src-tauri/src/lib.rs`：Tauri 命令与任务状态管理
