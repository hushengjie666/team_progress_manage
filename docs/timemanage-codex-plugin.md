# TimeManage Codex 插件安装

TimeManage Codex 插件让团队成员直接在 Codex 对话里操作 TimeManage 数据。服务器仍然只有一套 TimeManage 后端和 MySQL；每个成员本机只安装 Codex 插件和本人的账号配置。

## 一句话初始化

让团队成员在 Codex 里输入：

```text
请初始化 TimeManage Codex：从 GitHub 仓库 hushengjie666/team_progress_manage 安装插件，服务器地址 https://www.hudashuai.xyz/timemanage-team/api/，账号是 <你的账号>，密码请安装时单独隐藏询问我。
```

Codex 会拉取 bootstrap 脚本并执行。等价命令是：

```bash
curl -fsSL https://raw.githubusercontent.com/hushengjie666/team_progress_manage/v0.1.3/scripts/bootstrap-timemanage-codex.mjs \
  -o /tmp/bootstrap-timemanage-codex.mjs
node /tmp/bootstrap-timemanage-codex.mjs --email "<你的账号>"
```

默认服务器地址是：

```text
https://www.hudashuai.xyz/timemanage-team/api/
```

## 初始化做了什么

- 添加 TimeManage marketplace：`timemanage-team`
- 安装插件：`timemanage@timemanage-team`
- 写入本机 MCP 配置：
  - macOS/Linux：`~/.config/timemanage-mcp/config.json`
  - Windows：`%APPDATA%/TimeManage MCP/config.json`
- 验证 `/health`、`/auth/status`、`/auth/login`

密码只保存在本机配置文件，不写入仓库，也不写进 `~/.codex/config.toml`。

## 初始化后使用

重启 Codex 或开启新线程，然后直接说：

```text
用 TimeManage 检查连接是否正常
```

也可以说：

```text
用 TimeManage 查一下我今天的任务
```

## 维护插件

发版前刷新插件内容：

```bash
npm run plugin:build
npm run plugin:validate
```

完整验证：

```bash
npm run plugin:test
```
