# TimeManage

自律型番茄时间管理与团队进度系统，基于 Vite + React + TypeScript 前端和 Go/MySQL 团队后台构建。

## 已实现

- React Web 桌面界面：项目总览、工作区、我的任务、专注和管理中心。
- 番茄方法论工作流：活动清单、今日承诺、单任务计时、内外中断和作废记录。
- 团队进度管理：项目成员、任务阶段、验收流、排期视图和成员状况。
- 本地持久化：浏览器 `localStorage` 当前 schema。
- 团队后台服务：轻量 Go 单二进制服务，支持登录、工作区、项目成员、在线刷新与失败诊断。

## 开发命令

```bash
npm install
npm run dev
npm run build
npm run backend:build
npm run backend:server
```

## 本地后台验证

默认团队后台服务地址是 `http://127.0.0.1:8787`，账号/密码是 `admin/hu626699`。低内存服务器部署时只需要上传 `team-server/bin/timemanage-team` 这个二进制，并通过环境变量配置：

```bash
TM_BACKEND_USER=admin \
TM_BACKEND_PASSWORD=hu626699 \
TM_BACKEND_ADDR=0.0.0.0:8787 \
TM_BACKEND_MYSQL_DSN='root:<password>@tcp(127.0.0.1:3306)/timemanage_team?parseTime=true&charset=utf8mb4' \
./timemanage-team serve
```

前端在“设置 -> 团队后台”里登录后可以立即刷新任务、今日计划、番茄记录、中断和基础设置，并查看后台 与诊断结果。
