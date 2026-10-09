# TimeManage Team Ubuntu 部署记录

## 2026-10-09 部署状态

Ubuntu 24.04 amd64 服务器沿用已有 Nginx HTTPS 网站和证书。TimeManage 使用旧站约定的 `/timemanage-team/` 前端和 `/timemanage-team/api/` API 路径，后端仅监听 `127.0.0.1:8787`。其他应用不在此次部署范围内。

本次应用及修复工具来自提交 `22354eedd56e687472d2a1a43911a2833c1f5e96`。统一包由 `npm run deploy:team` 创建，最终版本目录为 `timemanageTeam-v0.2.10-20261009-165630`；Linux 后端使用同一提交交叉编译，并加入该目录的 `server/` 和同名 ZIP。此包是临时部署包，未创建新发布 tag。

版本合同为 release `0.2.10`、API protocol `2`、database schema `13`。MySQL 8.0 已安装，仅监听本机；应用数据库用户和签名密钥在服务器生成，凭据不进入发布包或 Git。

原始 Navicat 文件的 SHA-256 为 `5cb64cd84d5e81de2d1cf787c76709d3fe658c589158595b768231c27d54c3f5`，导出时间为 `2026-10-09 15:54:10`。业务表 INSERT 缺少 JSON `payload`；`account_settings` 和 `idempotency_keys` 的 JSON 仍在，分别缺少 `updated_at` 和 `created_at`。原文件直接导入在第 60 行报 MySQL `ERROR 1136`。原始 SQL 和部分导入的备份保留在服务器。

隔离库 `timemanage_team_validation` 仅用于安装验证。修复后的 `timemanage_team_candidate` 已成功导入 5 个账号、6 个工作区和 807 条业务记录，迁移 checksum、关联完整性审计、登录和浏览器验证通过。正式上线采用保留原始缓存快照、明确标记缺失详情的恢复方式；公网路由切换和正式运行库以本文最后的上线记录为准。

## 可恢复范围

`idempotency_keys.response_body` 的 313 条缓存中保存了业务快照。修复工具仅使用身份、所有者、时间戳和索引字段全部匹配的快照，不把较旧快照当成当前原始数据。

| 业务类型 | 原记录数量 | 完整 JSON 恢复 | 保留索引、待补全 |
| --- | ---: | ---: | ---: |
| 项目 | 16 | 4 | 12 |
| 项目成员 | 24 | 4 | 20 |
| 任务 | 111 | 61 | 50 |
| 每日计划 | 61 | 20 | 41 |
| 专注记录 | 155 | 74 | 81 |
| 工作记录 | 144 | 74 | 70 |
| 执行信号 | 290 | 138 | 152 |
| 奖励状态 | 6 | 0 | 6 |
| 合计 | 807 | 375 | 432 |

账号及密码哈希、工作区、成员关系和邀请内容保留。启动或登录可能正常刷新成员关系的 `updated_at`。缓存和账号设置缺失的元数据时间戳以响应 `server_time`、返回记录时间或账号时间补齐，并在恢复报告中标记为推导值。

缺少原始 JSON 的记录保留原 ID、关联关系、状态、阶段和日期。标题、描述、工时、计划清单、奖励和角色等无法从索引凭空找回：占位名称明确标为“待补全”，所需数字字段使用 0 等程序默认值，未知项目角色使用空列表，不推断管理权限。记录带有 `recovery` 元数据，页面对这些记录展示持续的数据缺失提示。数值默认值不能作为真实历史统计依据。

## 服务器目录

| 用途 | 路径 |
| --- | --- |
| 应用版本目录 | `/opt/timemanage-team/releases/timemanageTeam-v0.2.10-20261009-165630/` |
| 当前版本链接 | `/opt/timemanage-team/current` |
| Linux 后端 | `/opt/timemanage-team/current/server/timemanage-team-linux-amd64` |
| 前端静态文件 | `/opt/timemanage-team/current/web/` |
| 非敏感配置 | `/etc/timemanage-team/backend.json` |
| 环境凭据 | `/etc/timemanage-team/backend.env` |
| systemd 服务 | `/etc/systemd/system/timemanage-team.service` |
| Nginx 路由片段 | `/etc/nginx/snippets/timemanage-team.conf` |
| 现有 HTTPS 站点 | `/etc/nginx/sites-available/hudashuai.xyz` |
| 应用数据库备份 | `/var/lib/timemanage-team/backups/` |
| 导入原件及 Nginx 修改前备份 | `/var/backups/timemanage-team/import-20261009/` |

应用使用无登录权限的 `timemanage` 系统用户。版本目录由 root 管理，Nginx 可读取静态资源；环境凭据由 root 管理，仅服务组可读。systemd 加载 `backend.env`，配置 `TM_BACKEND_ADDR`、`TM_BACKEND_MYSQL_DSN`、`TM_BACKEND_USER`、`TM_BACKEND_PASSWORD`、`TM_BACKEND_SECRET` 和 `TM_BACKEND_BACKUP_DIR`。

历史账号由数据库中的密码哈希决定，环境中的账号密码不能覆盖历史账号。不要将 SSH 密码作为数据库密码或签名密钥。

## 重新导出历史数据

此次 Navicat 文件的问题是数据缺失，不是 Linux 路径或字符集兼容性：例如 `business_tasks` 有 11 列，111 条 INSERT 都只有 10 个值，缺少 `payload`；`account_settings` 有 3 列，INSERT 只有 2 个值，缺少时间戳。不能直接补空 JSON 或删掉 JSON 列来声称完整恢复。

旧服务器已重装，本次采用缓存快照和索引恢复。如果未来找到了完整旧库或备份，优先恢复原始 JSON。后续正常备份使用 MySQL 8 的 `mysqldump`；下面示例不在命令行中提供密码，由客户端交互提示：

```sh
mysqldump --host=127.0.0.1 --user=<数据库用户> --password \
  --default-character-set=utf8mb4 --single-transaction \
  --routines --triggers --events --hex-blob \
  --set-gtid-purged=OFF --column-statistics=0 \
  timemanage_team > timemanage_team-full.sql
```

Windows CMD 使用单行命令或 `^` 续行，不使用上例的 shell `\`。也可以使用旧应用的 `db backup`，同时提供 `.sql.gz` 和 `.sql.gz.json` 校验清单。

导出后先检查有 JSON 列的表确实包含 JSON 值，并在独立数据库中完成导入验证。旧 SQL 所显示的预期记录数量为：账号 5、工作区 6、项目 16、任务 111、每日计划 61、专注记录 155、工作记录 144、执行信号 290。新导出若源库已发生变化，以新源库统计为准。

## 修复工具及上线顺序

修复工具为 `scripts/recover-navicat-sql.py`，不连接数据库，不修改原 SQL，不覆盖现有输出。默认在找不到完整快照时停止；只有明确指定 `--allow-placeholders` 才生成标记缺失详情的占位 JSON。输出 SQL 和逐条恢复报告使用权限 `0600`，属于业务恢复材料，不放入应用发布包或 Git。

```sh
python3 scripts/recover-navicat-sql.py \
  --input <原SQL文件> --output <新修复SQL文件> \
  --report <恢复报告JSON文件> --allow-placeholders
python3 scripts/test_recover_navicat_sql.py
```

1. 校验修复 SQL 的 SHA-256、数据库范围、schema 版本及每条恢复决策；先导入独立候选库，不能直接覆盖已投入使用的库。
2. 保留原始文件、导入前数据库备份和 Nginx 配置备份。旧 SQL 的失败导入库不是可恢复的完整业务备份。
3. 对候选库使用匹配的 Linux 后端执行 `db status`、`db audit` 和 `db backup`。检查备份 gzip、清单及 SHA-256；有待迁移时再按数据库备份门禁执行 `db up`，并核对迁移 checksum。
4. 停止验证服务，配置正式后端指向已校验的恢复库。正式库的密码、签名密钥和历史数据只保留在服务器及受保护的恢复导出中。
5. 启动并启用 `timemanage-team.service`，检查本机 `/health`、数据库名称、版本合同、账号登录和业务读取。
6. 在现有 HTTPS `server` 内加入 `include /etc/nginx/snippets/timemanage-team.conf;`。先执行 `sudo nginx -t`，通过后再 `sudo systemctl reload nginx`。
7. 验证公网前端、静态资源、API、登录、历史项目和任务、缺失详情提示、WebSocket `101`、心跳与重连。确认原有首页和隐私页正常。
8. 移除验证用站点和服务，保留迁移恢复材料，记录最终正式库名及记录数量。

数据库操作需要加载服务环境变量；下面仅展示只读状态检查。备份、升级和审计使用同样的环境加载方式，并替换 `db status` 子命令：

```sh
sudo -u timemanage sh -c '
  set -a
  . /etc/timemanage-team/backend.env
  set +a
  exec /opt/timemanage-team/current/server/timemanage-team-linux-amd64 \
    db status --config /etc/timemanage-team/backend.json
'
```

`timemanage-team.service` 使用 `Restart=on-failure`，并配置 `NoNewPrivileges`、`PrivateTmp`、`ProtectHome` 和 `ProtectSystem=strict`；仅 `/var/lib/timemanage-team` 可写。后端和 MySQL 无需对公网开放端口。

## Nginx 与验证

原有网站的 HTTPS 证书、首页、隐私页、HTTP 到 HTTPS 重定向保持原有配置。TimeManage 路由采用 Linux alias，不复制旧 Windows 的 `C:/...` 路径。

通用 API 的 `proxy_pass http://127.0.0.1:8787/;` 保留末尾 `/`，移除外部的 `/timemanage-team/api/` 前缀。`/timemanage-team/api/app/events` 使用独立精确匹配、HTTP/1.1、Upgrade/Connection 请求头、关闭代理缓冲和一小时超时。[Nginx 官方 WebSocket 说明](https://nginx.org/en/docs/http/websocket.html)说明了 Upgrade 请求头需要显式转发。

正式上线后的验证地址：

```text
http://127.0.0.1:8787/health
https://www.hudashuai.xyz/timemanage-team/api/health
https://www.hudashuai.xyz/timemanage-team/
```

运维检查：

```sh
sudo systemctl status timemanage-team
sudo journalctl -u timemanage-team --no-pager -n 50
sudo nginx -t
sudo ss -lnt
```

服务重启和 Nginx 重载通过验证后才执行。后续升级继续从统一版本目录取 `web/` 和 `server/`，先备份数据库、准备新版本目录，再切换 `current`；跨版本回退遵守 `server/DATABASE-OPERATIONS.md`，不自动恢复数据库或降级程序。

## 正式上线结果

2026-10-09 已将修复 SQL 导入正式库 `timemanage_team`，启用 `timemanage-team.service` 开机启动，并在现有 HTTPS 站点加入 TimeManage 路由。临时本机 Nginx 验证站点已移除；候选库和原始导入材料保留，未替代原始 SQL 文件。

部署时验证结果：

- `/health` 返回 `status: ok`、`database_status: ready`、release `0.2.10`、API `2`、schema `13`；正式库有 16 个项目、111 个任务、807 条业务记录。
- 375 条 JSON 与原缓存快照逐条一致；432 条缺失详情记录保留恢复标记。
- 账号与工作区原数据、成员关系身份及权限保留；启动、登录正常刷新成员关系元数据时间。
- 公网前端、API、旧首页与隐私页返回 200，登录成功，页面展示“历史数据待补全”。
- Nginx WebSocket 返回 101，25 秒 ping/pong 及浏览器重连通过；后端与 MySQL 仅监听本机。
- 前端 310 个单元测试、SQL 修复 8 个测试、浏览器流程 38 项通过（6 项跳过）；Go 后端、版本合同、迁移检查和质量检查通过。
- 统一 ZIP 完整性、macOS DMG 校验和、签名 iOS Archive/IPA 构建及截图交付检查通过。

正式库启用前的应用备份为 `/var/lib/timemanage-team/backups/timemanage-db-0.2.10-20261009-165659-000.sql.gz`，其 SHA-256 为 `a00b7079f0bf0e7445574114f8c7288ebf4bb37664d46a18b219674b7b3c4dec`；同名 `.json` 清单保留。原始 SQL、修复 SQL、逐条恢复报告、部分导入备份、Nginx 修改前配置及旧版本链接记录位于 `/var/backups/timemanage-team/import-20261009/`。

应用安装成功不等于所有历史详情完整恢复。后续业务整理应优先补全带恢复标记的项目、成员、任务和记录，报表中的默认数值不代表已找回的原始估时或工时。

## 已上线记录的证据补全

`scripts/enrich-navicat-recovery.py` 用原始 Navicat 导出和当前项目、任务的 JSONL 快照生成补全计划及 SQL，不重新导入整库。快照每行包含 `table`、`workspace_id`、`id`、`account_id`、`project_id`、`task_id`、`status`、`kind`、`row_date`、`updated_at` 和 JSON 对象 `payload`；`table` 只允许 `business_projects`、`business_tasks`。原始文件及输出均属于业务恢复资料，不进入 Git 或应用包。

```sh
python3 scripts/enrich-navicat-recovery.py \
  --input <原SQL文件> --current <当前项目任务JSONL快照> \
  --plan <新补全计划JSON> --sql <新补全SQL>
python3 scripts/test_enrich_navicat_recovery.py
python3 scripts/test_recover_navicat_sql.py
```

补全范围严格限制为：同一工作区、同一项目的完整任务快照中一致的项目名称，以及原 SQL 索引和关联记录可确认的上下文。项目说明、任务备注中的上下文是整理后的说明，不声称恢复了原始文字。所属账号不等于负责人；索引日期不等于完整创建时间；关联记录条数不等于工时。缺失的任务标题、负责人、权限、估时和实际工时不推断，`recovery.originalPayloadAvailable` 继续为 `false`。

工具只处理未被编辑的原占位记录。导入后时间戳、文字或索引已有变化的记录会跳过或拒绝；完整快照保持原样。计划包含更新前、更新后的 JSON，输出权限为 `0600`，已有输出不覆盖。

执行前必须制作并验证正式库备份，在隔离数据库中恢复备份、应用补全 SQL、逐条比较计划并运行 `db audit`。SQL 使用行锁、完整 JSON 和索引前像检查，所有检查先于更新；任何冲突必须中止整个事务。使用 MySQL 8 批处理客户端执行，**禁止 `--force`**，否则检查失败后继续执行会破坏事务保护。

2026-10-09 的补全已应用到正式库：8 个项目名称由完整任务快照补回，12 个项目说明和 50 条缺失任务备注补充了可核实的信息；4 个项目原名和 50 条任务原题仍缺失。16 个项目、111 条任务、807 条业务记录数量保持不变，原来完整恢复的 4 个项目和 61 条任务及其他业务 JSON 保持原样。缺失详情的总数未减少，因为这些记录仍未完整恢复。

此次验证包含 SQL 修复和补全的 17 项单元测试、真实 MySQL 备份恢复、62 条 JSON 逐条比较、最后一条记录模拟并发编辑时的整批回滚及数据库关联审计。本机客户端通过“管理中心 → 团队后台 → 刷新在线数据”读取更新；SQL 维护不会主动发送实时变更事件，其他已打开的客户端也应执行刷新。

更新前备份为 `/var/lib/timemanage-team/backups/timemanage-db-0.2.10-20261009-172809-000.sql.gz`，SHA-256 为 `d09676e6b9731a3de9d55a1bb209694c055da0c36c26e84137ec96c55dfe9646`，同名清单已核对。原计划、最终计划、执行 SQL 和日志保存在 `/var/backups/timemanage-team/enrichment-20261009-172808/`。本次为业务数据整理，未修改 schema、迁移文件或客户端二进制。
