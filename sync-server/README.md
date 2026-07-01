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
./timemanage-sync migrate status           # 查看数据库版本状态
./timemanage-sync migrate up               # 执行待升级数据库迁移
./timemanage-sync migrate verify           # 校验数据库版本和关键表结构
./timemanage-sync migrate backup           # 使用 mysqldump 备份数据库
./timemanage-sync migrate restore --input <file.sql> # 使用 mysql 命令恢复备份
./timemanage-sync migrate down --to <ver>  # 回退到指定数据库版本（仅限可逆迁移）
./timemanage-sync service                  # Windows 下以服务进程模式运行
./timemanage-sync install --config <path>   # 安装 Windows Service（Windows 平台）
./timemanage-sync uninstall                # 卸载 Windows Service（Windows 平台）
./timemanage-sync start                    # 启动 Windows Service（Windows 平台）
./timemanage-sync stop                     # 停止 Windows Service（Windows 平台）
```

> 说明：`service` 用于 Windows 服务进程入口；普通用户也可直接用 `serve`，两者参数同源、都支持 `--config` 与配置文件/环境变量。

## 数据库版本管理

MySQL schema 和数据修复必须走版本化迁移，不再手动登录数据库执行临时 SQL。迁移文件放在 `sync-server/migrations/`，发布后只允许追加新版本，不允许修改已经执行过的迁移文件。

推荐升级流程是直接双击 Windows 部署包里的脚本：

```text
upgrade.bat
```

部署包目录带版本号，例如 `timemanageTeam-v0.1.0-20260701-153000`。默认把同级 `timemanageTeam` 作为正式运行目录，自动完成：停止后端、创建回退点、备份数据库、安装新后端、安装新网页、升级数据库、校验数据库、启动后端、健康检查。

需要回退时直接双击：

```text
rollback.bat
```

它会默认使用最近一次 `upgrade.bat` 创建的回退点，自动恢复数据库、恢复旧后端、恢复旧网页并启动检查。正常情况下不需要手动打开 MySQL 工具导入 SQL。

手动命令仅用于排查问题：

```bash
./timemanage-sync migrate status --config sync.json
./timemanage-sync migrate backup --config sync.json
./timemanage-sync migrate up --config sync.json
./timemanage-sync migrate verify --config sync.json
./timemanage-sync serve --config sync.json
```

服务启动时也会自动执行待升级迁移；如果发现迁移失败、dirty 状态或已执行迁移的 checksum 被改动，服务会拒绝启动。正式部署仍应优先用 `upgrade.bat`，因为它会先创建完整回退点。

Windows 部署包包含：

- `upgrade.bat`：版本包根目录入口，一键升级同级 `timemanageTeam` 正式目录。
- `rollback.bat`：版本包根目录入口，一键回退同级 `timemanageTeam` 正式目录。
- `sync\release\timemanage-sync.exe`：待安装的新后端程序。
- `sync\sync.example.json`：首次部署时用于生成正式目录 `sync.json` 的配置模板。

## API

- `GET /health`
- `POST /auth/login`
- `GET /sync/pull?since=<revision>`
- `POST /sync/push`
- `GET /sync/status`

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
npm run sync:build:windows
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
