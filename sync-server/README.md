# TimeManage Backend Service

P0 team backend service. It is a small Go HTTP server with MySQL persistence, designed to be built as a single binary for low-memory servers that already have MySQL available. The binary and package paths still use `timemanage-sync` / `sync-server` for compatibility, but the service now owns authentication, members, project state, and sync APIs.

## Build

```bash
cd sync-server
go build -trimpath -ldflags="-s -w" -o bin/timemanage-sync .
```

## Run Locally

```bash
TM_SYNC_USER=demo \
TM_SYNC_PASSWORD=demo \
TM_SYNC_ADDR=127.0.0.1:8787 \
TM_SYNC_MYSQL_DSN='root:<password>@tcp(127.0.0.1:3306)/timemanage_sync?parseTime=true&charset=utf8mb4' \
./sync-server/bin/timemanage-sync serve
```

Configuration priority is `flags > env > config file > defaults`.

```bash
./sync-server/bin/timemanage-sync serve \
  --config sync-server/config.example.json \
  --addr 127.0.0.1:8787
```

## 命令行入口

```bash
./timemanage-sync serve                    # 启动 HTTP 服务
./timemanage-sync service                  # Windows 下以服务进程模式运行
./timemanage-sync install --config <path>   # 安装 Windows Service（Windows 平台）
./timemanage-sync uninstall                # 卸载 Windows Service（Windows 平台）
./timemanage-sync start                    # 启动 Windows Service（Windows 平台）
./timemanage-sync stop                     # 停止 Windows Service（Windows 平台）
```

> 说明：`service` 用于 Windows 服务进程入口；普通用户也可直接用 `serve`，两者参数同源、都支持 `--config` 与配置文件/环境变量。

## 数据库初始化

服务启动时会在 MySQL 中幂等创建当前 schema。旧 JSON store、旧 MySQL 迁移链和回滚命令不再保留；如果 schema 需要重置，应重新初始化目标数据库后启动服务。

Windows 部署包包含：

- `sync\timemanage-sync.exe`：后端程序。
- `sync\sync.example.json`：首次部署时用于生成正式目录 `sync.json` 的配置模板。
- `sync\start-backend.bat` / `sync\stop-backend.bat`：手动启动和停止脚本。

## API

- `GET /health`
- `POST /auth/login`
- `GET /team/state`
- `GET /team/state/all`
- `GET /team/revision`
- `POST /team/changes`

The React app defaults to `http://127.0.0.1:8787`, username `demo`, password `demo`.

## Small Backend Deployment

Build on a machine with Go, then upload only the binary:

```bash
cd sync-server
GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o bin/timemanage-sync-linux-amd64 .
```

Run it behind a reverse proxy:

```bash
TM_SYNC_USER=<user> \
TM_SYNC_PASSWORD=<strong-password> \
TM_SYNC_SECRET=<long-random-secret> \
TM_SYNC_ADDR=127.0.0.1:8787 \
TM_SYNC_MYSQL_DSN='<user>:<password>@tcp(127.0.0.1:3306)/timemanage_sync?parseTime=true&charset=utf8mb4' \
./timemanage-sync-linux-amd64
```

The service creates the database and tables on startup when the configured MySQL account has permission:

```sql
CREATE DATABASE timemanage_sync
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Caddy example:

```caddyfile
sync.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

The app can then use `https://sync.example.com` as the backend service URL.

For a long-running Linux backend service, copy the binary plus the two helper files and run:

```bash
sudo ./install-linux-service.sh
```

The script installs:

- binary: `/opt/timemanage-sync/timemanage-sync`
- config: `/etc/timemanage-sync/sync.json`
- unit: `/etc/systemd/system/timemanage-sync.service`

After editing `/etc/timemanage-sync/sync.json` and setting `mysql_dsn`, restart the backend service with:

```bash
sudo systemctl restart timemanage-sync
curl http://127.0.0.1:8787/health
```

## Windows Backend Service Deployment

Build a small Windows binary:

```bash
npm run backend:build:windows
```

Copy `sync-server/bin/timemanage-sync.exe`, `sync-server/config.example.json`, and
`sync-server/install-windows-service.ps1` to the Windows server, edit the copied config,
then run PowerShell as Administrator:

```powershell
cd C:\path\to\sync-server
.\install-windows-service.ps1 -InstallDir C:\TimeManage\sync -ConfigPath C:\TimeManage\sync\sync.json
```

Manual service commands are also available:

```powershell
timemanage-sync.exe install --config C:\TimeManage\sync\sync.json
timemanage-sync.exe start
timemanage-sync.exe stop
timemanage-sync.exe uninstall
```

When running Windows Service directly, make sure the binary uses service mode:

```powershell
timemanage-sync.exe service --config C:\TimeManage\sync\sync.json
```
