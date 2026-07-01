# TimeManage Team 部署记录

这份记录固定 2026-07-01 晚上整理过的服务器部署约定，避免后续重新打包时忘记路径、base、Nginx 和 Windows Server 兼容构建方式。

## 固定部署入口

正式发布必须先创建 Git tag，再从 tag 打包。不要从当前脏工作区直接生成正式发布包。

创建 tag 前先完成提交，并确保工作区干净：

```sh
npm run release:team:create-tag -- v0.1.1
```

从指定 tag 打包：

```sh
npm run release:team:tag -- v0.1.1
```

临时测试包才使用：

```sh
npm run deploy:team
```

打包结果固定为：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>.zip
```

这个压缩包必须带外层版本根目录。压缩包文件名和解压后的根目录同名，例如：

```text
timemanageTeam-v0.1.0-20260701-153000.zip
timemanageTeam-v0.1.0-20260701-153000/
```

服务器上的正式运行目录固定为：

```text
C:/Users/Administrator/Desktop/timemanageTeam/
```

版本包解压到正式目录的同级目录，例如：

```text
C:/Users/Administrator/Desktop/timemanageTeam/
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/
```

当前线上如果来自旧的 `timemanageTeam-no-root.zip`，正式目录通常是：

```text
C:/Users/Administrator/Desktop/timemanageTeam/web/
C:/Users/Administrator/Desktop/timemanageTeam/sync/sync.json
C:/Users/Administrator/Desktop/timemanageTeam/sync/timemanage-sync.exe
```

这是支持直接升级的旧部署形态。新版本包里的 `upgrade.bat` 会自动备份这些旧文件和数据库，再安装新版本。

推荐把新版本包解压到 `Desktop` 下，与 `timemanageTeam` 同级。若误解压到 `timemanageTeam` 目录内部，脚本会检测父目录里已有 `sync/sync.json` 和 `web/index.html`，并把父目录作为正式目录，避免创建嵌套的 `timemanageTeam/timemanageTeam`。

版本包目录里应包含：

```text
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/upgrade.bat
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/rollback.bat
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/RELEASE.txt
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/web-release/index.html
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/sync/release/timemanage-sync.exe
C:/Users/Administrator/Desktop/timemanageTeam-v0.1.0-20260701-153000/sync/sync.example.json
```

正式运行目录仍然是 `C:/Users/Administrator/Desktop/timemanageTeam/web/` 和 `C:/Users/Administrator/Desktop/timemanageTeam/sync/timemanage-sync.exe`。不要手动复制 `web-release` 或 `sync/release`；双击版本包里的 `upgrade.bat` 后，脚本会自动备份正式目录旧版本并复制新版本到正式目录。

如果正式目录不是版本包同级的 `timemanageTeam`，可以把目标目录作为第一个参数传给脚本：

```bat
upgrade.bat C:\Users\Administrator\Desktop\timemanageTeam
rollback.bat C:\Users\Administrator\Desktop\timemanageTeam
```

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

打包脚本会在临时目录里构建，不会改动仓库里的 `sync-server/go.mod`。兼容构建时临时使用：

```text
github.com/go-sql-driver/mysql v1.8.1
golang.org/x/sys v0.16.0
golang.org/x/crypto v0.17.0
go 1.20
```

最终产物会复制到：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/sync/release/timemanage-sync.exe
```

## 后端配置

服务器配置文件固定放在：

```text
C:/Users/Administrator/Desktop/timemanageTeam/sync/sync.json
```

本地打包目录里对应：

```text
deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>/sync/sync.example.json
```

服务器上的 `sync.json` 包含数据库账号和服务密钥，不能提交到仓库。打包文件不会覆盖服务器现有 `sync.json`。当前 `.gitignore` 已忽略 `deploy/**/sync.json`、部署 zip 和后端 exe。

MySQL 数据库名：

```text
timemanage_sync
```

如果线上数据库已经初始化过账号，`sync.json` 里的 `username/password` 不会覆盖数据库账号；登录账号以数据库里的账号表为准。需要重置管理员账号时，应单独处理数据库或重新初始化库。

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

注意 `proxy_pass` 后面要带 `/`，这样 `/timemanage-team/api/health` 才会转到后端 `/health`。

## 服务器操作顺序

1. 本地运行 `npm run deploy:team`。
2. 上传 `deploy/timemanageTeam-v<version>-<yyyyMMdd-HHmmss>.zip` 到服务器的 `C:/Users/Administrator/Desktop/`。
3. 在 Desktop 下解压，确认出现同名版本目录，例如 `timemanageTeam-v0.1.0-20260701-153000/`。
4. 首次部署时，如果正式目录还没有 `timemanageTeam/sync/sync.json`，双击版本包里的 `upgrade.bat` 会先生成 `sync.json` 并提示编辑；编辑数据库、端口或密钥后再重新运行 `upgrade.bat`。
5. 双击版本包根目录的 `upgrade.bat` 升级；脚本会自动定位同级 `timemanageTeam` 正式目录，创建回退点、备份数据库、安装新前后端、执行数据库迁移、启动后端并检查 `/health`。
6. 重载 Nginx。

需要回退时，直接双击：

```text
版本包根目录/rollback.bat
```

默认会回退同级 `timemanageTeam` 正式目录到最近一次 `upgrade.bat` 创建的回退点，包括数据库、后端 exe 和前端 web 文件。默认情况下不需要进入 `sync/` 目录执行升级或回退脚本。

## 数据库升级与回退细节

`upgrade.bat` 会在修改正式目录和数据库前创建回退点：

```text
C:/Users/Administrator/Desktop/timemanageTeam/sync/rollback/<yyyyMMdd-HHmmss>/
```

回退点包含：

```text
database.sql                    # 升级前完整 MySQL 备份
timemanage-sync.exe             # 升级前旧后端
restore-tool.exe                # 本次发布包里的恢复工具
sync.json                       # 升级前正式配置
web/                            # 升级前旧前端
upgrade-info.txt                # 本次升级来源、正式目录、时间戳
migration-status-before.txt     # 升级前数据库版本状态
migration-status-after.txt      # 升级后数据库版本状态
```

数据库备份成功后，脚本会立即写入：

```text
C:/Users/Administrator/Desktop/timemanageTeam/sync/rollback/latest.txt
```

所以只要数据库备份已经成功，后续即使安装后端、安装前端、执行迁移或健康检查失败，也可以直接运行版本包里的 `rollback.bat` 回到升级前状态。

回退时会优先使用回退点里的 `restore-tool.exe` 执行数据库恢复；这样即使正式目录里的新 `timemanage-sync.exe` 安装后异常，也不会阻塞数据库回滚。

数据库备份/恢复依赖服务器上能从命令行调用：

```text
mysqldump
mysql
```

如果 Windows 找不到这两个命令，升级脚本会在数据库备份阶段失败并停止，不会继续覆盖正式程序。此时需要把 MySQL 的 `bin` 目录加入系统 `PATH`，或者在命令行窗口中临时设置 `PATH` 后重新运行。

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
