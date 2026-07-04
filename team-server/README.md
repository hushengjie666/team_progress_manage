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
```

> 说明：`service` 用于 Windows 服务进程入口；普通用户也可直接用 `serve`，两者参数同源、都支持 `--config` 与配置文件/环境变量。

## 数据库初始化

服务启动时会在 MySQL 中幂等创建当前 schema。如果 schema 需要重置，应重新初始化目标数据库后启动服务。

Windows 部署包包含：

- `server\timemanage-team.exe`：后端程序。
- `server\backend.example.json`：首次部署时用于生成正式目录 `backend.json` 的配置模板。
- `server\start-backend.bat` / `server\stop-backend.bat`：手动启动和停止脚本。

## API

- `GET /health`
- `POST /auth/login`
- `GET /team/data`
- `POST /team/data`

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
