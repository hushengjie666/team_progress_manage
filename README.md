# TimeManage

自律型番茄时间管理与团队进度系统，基于 Vite + React + TypeScript 前端和 Go/MySQL 团队后台构建。

## 已实现

- React Web 桌面界面：工作台、专注、报告、设置四个主区。
- 番茄方法论闭环：活动清单、今日承诺、单任务计时、内外中断、作废、日终复盘。
- 自律激励：分心成本、连续目标、成就、热力图、年度番茄墙。
- 本地持久化：浏览器 `localStorage` 当前 schema。
- 团队后台服务：轻量 Go 单二进制服务，支持登录、工作区、项目成员、推送、拉取、删除 tombstone、在线刷新与失败诊断。

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run backend:build
npm run backend:server
```

## 本地后台验证

默认团队后台服务地址是 `http://127.0.0.1:8787`，账号/密码是 `demo/demo`。低内存服务器部署时只需要上传 `sync-server/bin/timemanage-sync` 这个二进制，并通过环境变量配置：

```bash
TM_SYNC_USER=demo \
TM_SYNC_PASSWORD=demo \
TM_SYNC_ADDR=0.0.0.0:8787 \
TM_SYNC_MYSQL_DSN='root:<password>@tcp(127.0.0.1:3306)/timemanage_sync?parseTime=true&charset=utf8mb4' \
./timemanage-sync serve
```

前端在“设置 -> 团队后台”里登录后可以立即同步任务、今日计划、番茄记录、中断和基础设置，并查看后台 revision 与诊断结果。
