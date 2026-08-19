# TimeManage Team 部署记录

这份记录固定 2026-07-01 晚上整理过的服务器部署约定，避免后续重新打包时忘记路径、base、Nginx 和 Windows Server 兼容构建方式。

## 固定部署入口

正式发布必须先创建 Git tag，再从 tag 打包。不要从当前脏工作区直接生成正式发布包。

创建 tag 前先完成提交，并确保工作区干净：

```sh
git switch -c release/v0.2.9
git push -u origin release/v0.2.9
bash scripts/create-timemanage-release-tag.sh v0.2.9 "TimeManage Team v0.2.9"
git push origin v0.2.9
git switch main
git merge --ff-only release/v0.2.9
git push origin main
git branch -d release/v0.2.9
git push origin --delete release/v0.2.9
```

从指定 tag 打包：

```sh
npm run release:team:tag -- v0.2.9
```

临时测试包才使用：

```sh
npm run deploy:team
```

打包结果固定为同名目录和 ZIP：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>.zip
```

`npm run deploy:team` 会一次构建 Tauri、团队 Web 前端和 Windows 后端。所有可管理产物统一复制到版本目录；`src-tauri/target/` 和 `dist/` 仍是构建工具使用的中间输出，不作为交付入口。

统一版本目录结构：

```text
timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/desktop/   Tauri 应用与安装包
timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/web/       服务器 Web 前端
timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/server/    Windows 后端与部署脚本
timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/RELEASE.txt
```

在 macOS Apple Silicon 上，Tauri 产物位于：

```text
desktop/macos/TimeManage.app
desktop/dmg/TimeManage_<version>_aarch64.dmg
```

这个压缩包必须带外层版本根目录。压缩包文件名和解压后的根目录同名，例如：

```text
timemanageTeam-v0.2.9-20260819-153000.zip
timemanageTeam-v0.2.9-20260819-153000/
```

服务器上的正式运行目录固定为：

```text
C:/Users/Administrator/Desktop/timemanageTeam/
```

版本包解压到正式目录的同级目录，例如：

```text
C:/Users/Administrator/Desktop/timemanageTeam/
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/
```

正式目录结构为：

```text
C:/Users/Administrator/Desktop/timemanageTeam/web/
C:/Users/Administrator/Desktop/timemanageTeam/server/backend.json
C:/Users/Administrator/Desktop/timemanageTeam/server/timemanage-team.exe
```

推荐先将新版本解压到独立版本目录，按 `server/DATABASE-OPERATIONS.md` 完成数据库备份和升级验证，再切换正式运行目录。

版本包目录里应包含：

```text
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/desktop/
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/RELEASE.txt
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/web/index.html
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/server/timemanage-team.exe
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/server/backend.example.json
C:/Users/Administrator/Desktop/timemanageTeam-v0.2.9-20260819-153000/server/start-backend.bat
```

正式运行目录仍然是 `C:/Users/Administrator/Desktop/timemanageTeam/web/` 和 `C:/Users/Administrator/Desktop/timemanageTeam/server/timemanage-team.exe`。首次部署时从 `server/backend.example.json` 创建 `server/backend.json` 并编辑数据库、端口和密钥。

## 当前线上路径

前端地址：

```text
https://www.hudashuai.xyz/timemanage-team/
```

后端 API 地址：

```text
https://www.hudashuai.xyz/timemanage-team/api/
```

本机后端监听：

```text
http://127.0.0.1:8787
```

前端必须按子路径构建：

```sh
npm run build -- --base=/timemanage-team/
```

`npm run deploy:team` 已经包含这个参数。

tag 打包会把 Git tag、commit 和工作区状态写入发布包的 `RELEASE.txt`，用于服务器上追溯具体来源。

## 后端兼容构建

腾讯云服务器是 Windows Server 2008 R2。不要直接用本机当前 Go 版本构建 Windows 后端，否则可能在服务器上崩溃。

固定用 Docker 的 Go 1.20 构建兼容版：

```text
golang:1.20-bookworm
```

打包脚本会在临时目录里构建，不会改动仓库里的 `team-server/go.mod`。兼容构建时临时使用：

```text
github.com/go-sql-driver/mysql v1.8.1
github.com/pressly/goose/v3 v3.20.0
golang.org/x/sys v0.18.0
golang.org/x/crypto v0.21.0
go 1.20
```

最终产物会复制到：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/server/timemanage-team.exe
```

## 后端配置

服务器配置文件固定放在：

```text
C:/Users/Administrator/Desktop/timemanageTeam/server/backend.json
```

本地打包目录里对应：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/server/backend.example.json
```

服务器上的 `backend.json` 包含数据库账号和服务密钥，不能提交到仓库。打包文件只包含 `backend.example.json`，不会生成正式 `backend.json`。当前 `.gitignore` 已忽略 `deploy/**/backend.json`、部署 zip 和后端 exe。

MySQL 数据库名：

```text
timemanage_team
```

如果线上数据库已经初始化过账号，`backend.json` 里的 `username/password` 不会覆盖数据库账号；登录账号以数据库里的账号表为准。需要重置管理员账号时，应单独处理数据库或重新初始化库。

## Nginx 配置

当前本地备份文件：

```text
/Users/hushengjie/Desktop/nginx.conf
```

线上 HTTPS `server { listen 443 ssl; server_name www.hudashuai.xyz; ... }` 中的 TimeManage Team 配置固定为：

```nginx
location = /timemanage-team {
    return 301 /timemanage-team/;
}

# TimeManage Team 实时同步；必须放在通用 API location 前面
location = /timemanage-team/api/app/events {
    proxy_pass http://127.0.0.1:8787/app/events$is_args$args;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}

# TimeManage Team 后端 API
location ^~ /timemanage-team/api/ {
    proxy_pass http://127.0.0.1:8787/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_read_timeout 3600s;
}

# TimeManage Team 前端
location ^~ /timemanage-team/ {
    alias C:/Users/Administrator/Desktop/timemanageTeam/web/;
    try_files $uri $uri/ /timemanage-team/index.html;
    index index.html;
}
```

注意通用 API 的 `proxy_pass` 后面要带 `/`，这样 `/timemanage-team/api/health` 才会转到后端 `/health`。发布包里的 `server/nginx-websocket.conf` 可直接复制；重载后需要确认 `/app/events` 返回 `101 Switching Protocols`，并验证心跳和断线重连。

## 服务器操作顺序

1. 本地运行 `npm run deploy:team`。
2. 上传 `deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>.zip` 到服务器的 `C:/Users/Administrator/Desktop/`。
3. 在 Desktop 下解压，确认出现同名版本目录，例如 `timemanageTeam-v0.2.9-20260819-153000/`。
4. 如果正式目录还没有 `timemanageTeam/server/backend.json`，复制 `server/backend.example.json` 为 `server/backend.json` 并编辑数据库、端口或密钥。
5. 运行 `timemanageTeam/server/start-backend.bat`，或用 `install-windows-service.ps1` 安装 Windows Service。
6. 重载 Nginx。

## 数据库升级与回退

`v0.1.2` 是永久迁移基线。`v0.2.2` 起，后端启动时会持有 MySQL advisory lock 并自动执行安全迁移；数据库版本高于后端支持版本时会拒绝启动。每个发布包的 `server/migrations/` 都包含对应 SQL，程序本身也内嵌同一份 SQL。

正式部署顺序：

1. 停止后端服务。
2. 运行 `server/backup-database.bat`，保留 `.sql.gz` 及同名 `.json` 校验清单。
3. 运行 `server/migrate-database.bat` 和 `server/database-status.bat`。
4. 启动新后端并验证 `/health`。

安全回退使用 `rollback-database.bat <release>`，最低只能回到 `v0.1.2`。会丢失或重新解释数据的迁移不执行 Down SQL，必须使用 `restore-database.bat <backup.sql.gz>` 恢复。完整规则与命令见发布包中的 `server/DATABASE-OPERATIONS.md`。

## 验证地址

服务器本机先测：

```text
http://127.0.0.1:8787/health
```

公网再测：

```text
https://www.hudashuai.xyz/timemanage-team/api/health
https://www.hudashuai.xyz/timemanage-team/
```

如果公网 API 返回 404，优先检查 Nginx 的 `/timemanage-team/api/` location 是否在 HTTPS server 里，以及是否已经重载 Nginx。

## 登录行为

正式系统登录页不预填管理员账号和密码。账号密码只在用户勾选“记住账号密码”并成功登录后写入本机浏览器缓存；点击退出登录会清除已记住的账号密码。
