# TimeManage Backend Service

P0 team backend service. It is a small Go HTTP server with MySQL persistence, designed to be built as a single binary for low-memory servers that already have MySQL available. The service owns authentication, members, workspace invitations, project invitations, and online business state APIs.

## Build

```bash
cd team-server
go build -trimpath -ldflags="-s -w" -o bin/timemanage-team .
```

## Run Locally

```bash
TM_BACKEND_USER=admin \
TM_BACKEND_PASSWORD=hu626699 \
TM_BACKEND_ADDR=127.0.0.1:8787 \
TM_BACKEND_MYSQL_DSN='root:<password>@tcp(127.0.0.1:3306)/timemanage_team?parseTime=true&charset=utf8mb4' \
./teamBackend-server/bin/timemanage-team serve
```

Configuration priority is `flags > env > config file > defaults`.

```bash
./teamBackend-server/bin/timemanage-team serve \
  --config team-server/config.example.json \
  --addr 127.0.0.1:8787
```

## 命令行入口

```bash
./timemanage-team serve                    # 启动 HTTP 服务
./timemanage-team service                  # Windows 下以服务进程模式运行
./timemanage-team install --config <path>   # 安装 Windows Service（Windows 平台）
./timemanage-team uninstall                # 卸载 Windows Service（Windows 平台）
./timemanage-team start                    # 启动 Windows Service（Windows 平台）
./timemanage-team stop                     # 停止 Windows Service（Windows 平台）
./timemanage-team db status --config <path> # 查看数据库版本
./timemanage-team db up --config <path>     # 升级到当前数据库版本
./timemanage-team db backup --config <path> # 创建校验过的 gzip SQL 备份
./timemanage-team db rollback --config <path> --to v0.1.2 --confirm
./timemanage-team db restore --config <path> --file <backup.sql.gz> --confirm
```

> 说明：`service` 用于 Windows 服务进程入口；普通用户也可直接用 `serve`，两者参数同源、都支持 `--config` 与配置文件/环境变量。

## 数据库初始化

`v0.1.2` 是数据库迁移基线。服务启动时会获取 MySQL advisory lock，校验已发布 SQL 的 SHA-256，并自动应用安全的待执行迁移。数据库版本高于当前服务版本时，服务会拒绝启动。

完整升级、备份、回退和恢复流程见 `DATABASE-OPERATIONS.md`。

Windows 部署包包含：

- `server\timemanage-team.exe`：后端程序。
- `server\backend.example.json`：首次部署时用于生成正式目录 `backend.json` 的配置模板。
- `server\start-backend.bat` / `server\stop-backend.bat`：手动启动和停止脚本。
- `server\migrations\`：与程序内嵌内容一致的版本化 SQL。
- `server\DATABASE-OPERATIONS.md` 和数据库运维批处理：升级、备份、回退和恢复入口。

## API

- `GET /health`
- `POST /auth/login`
- `GET /app/bootstrap`：登录后聚合读取当前工作区与可见业务数据。
- `POST /projects`、`PATCH /projects/{id}`、`DELETE /projects/{id}`
- `POST /tasks`、`PATCH /tasks/{id}`、`DELETE /tasks/{id}`
- `POST /daily-plans/{id}/add-task|remove-task|move-task`
- `POST /tasks/{id}/start|split|submit-review|accept-review|return-review|archive|restore`
- `POST /work-sessions/{id}/pause|resume|finish`
- `GET /settings`、`PATCH /settings`

业务数据只以后端数据库为准。正式客户端业务请求必须携带 `X-TimeManage-Client-Release` 和 `X-TimeManage-API-Protocol`；旧客户端或缺少请求头的写请求会收到结构化 `426 Upgrade Required`。字段修改在事务内合并，跨实体动作原子提交，命令重试可使用 `Idempotency-Key`。

The React app defaults to `http://127.0.0.1:8787`, username `admin`, password `hu626699`.

## Small Backend Deployment

Build on a machine with Go, then upload only the binary:

```bash
cd team-server
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/timemanage-team-linux-amd64 .
```

Run it behind a reverse proxy:

```bash
TM_BACKEND_USER=<user> \
TM_BACKEND_PASSWORD=<strong-password> \
TM_BACKEND_SECRET=<long-random-secret> \
TM_BACKEND_ADDR=127.0.0.1:8787 \
TM_BACKEND_MYSQL_DSN='<user>:<password>@tcp(127.0.0.1:3306)/timemanage_team?parseTime=true&charset=utf8mb4' \
./timemanage-team-linux-amd64
```

The service creates the database and tables on startup when the configured MySQL account has permission:

```sql
CREATE DATABASE timemanage_team
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Caddy example:

```caddyfile
backend.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

The app can then use `https://backend.example.com` as the backend service URL.

For a long-running Linux backend service, copy the binary plus the two helper files and run:

```bash
sudo ./install-linux-service.sh
```

The script installs:

- binary: `/opt/timemanage-team/timemanage-team`
- config: `/etc/timemanage-team/backend.json`
- unit: `/etc/systemd/system/timemanage-team.service`

After editing `/etc/timemanage-team/backend.json` and setting `mysql_dsn`, restart the backend service with:

```bash
sudo systemctl restart timemanage-team
curl http://127.0.0.1:8787/health
```

## Windows Backend Service Deployment

Build a small Windows binary:

```bash
npm run backend:build:windows
```

Copy `team-server/bin/timemanage-team.exe`, `team-server/config.example.json`, and
`team-server/install-windows-service.ps1` to the Windows server, edit the copied config,
then run PowerShell as Administrator:

```powershell
cd C:\path\to\team-server
.\install-windows-service.ps1 -InstallDir C:\TimeManage\server -ConfigPath C:\TimeManage\server\backend.json
```

Manual service commands are also available:

```powershell
timemanage-team.exe install --config C:\TimeManage\server\backend.json
timemanage-team.exe start
timemanage-team.exe stop
timemanage-team.exe uninstall
```

When running Windows Service directly, make sure the binary uses service mode:

```powershell
timemanage-team.exe service --config C:\TimeManage\server\backend.json
```
