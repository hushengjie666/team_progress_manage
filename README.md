# TimeManage

自律型番茄时间管理系统首版实现，基于参考资料中的番茄工作法闭环、竞品图分析和旧系统升级方向构建。

## 已实现

- `Tauri + React + Rust` 应用骨架。
- React 响应式界面：工作台、专注、报告、设置四个主区。
- 番茄方法论闭环：活动清单、今日承诺、单任务计时、内外中断、作废、日终复盘。
- 自律激励：分心成本、连续目标、成就、热力图、年度番茄墙。
- 严格模式配置：App/网站屏蔽清单、Apple 原生插件命令边界、非 Apple 软严格降级。
- 本地优先持久化：Tauri 环境使用 SQLite，浏览器预览使用 `localStorage` fallback。
- P0/P0.5 同步服务：轻量 Go 单二进制服务，支持登录、推送、拉取、冲突返回、删除 tombstone、自动同步与失败重试。

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run sync:build
npm run sync:server
npm run tauri dev
```

## 本地同步验证

默认同步服务地址是 `http://127.0.0.1:8787`，账号/密码是 `demo/demo`。低内存服务器部署时只需要上传 `sync-server/bin/timemanage-sync` 这个二进制，并通过环境变量配置：

```bash
TM_SYNC_USER=demo \
TM_SYNC_PASSWORD=demo \
TM_SYNC_ADDR=0.0.0.0:8787 \
TM_SYNC_MYSQL_DSN='root:<password>@tcp(127.0.0.1:3306)/timemanage_sync?parseTime=true&charset=utf8mb4' \
./timemanage-sync
```

前端在“设置 -> 本地同步验证”里登录后可以立即同步任务、今日计划、番茄记录、中断、严格模式配置和基础设置；也可以开启自动同步并查看冲突列表。

## 原生严格模式边界

系统级屏蔽无法由普通 WebView 独立完成。本实现保留稳定命令 API：

- `request_strict_permissions`
- `start_strict_mode`
- `stop_strict_mode`

iOS 后续接入 `FamilyControls / ManagedSettings / DeviceActivity`；macOS 后续接入辅助功能权限和网站过滤能力。
