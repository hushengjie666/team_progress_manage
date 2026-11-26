# 补齐项目自动检查并恢复已验收 PR

## 目标
为 TimeManage 建立 GitHub Actions 自动检查，并为以下已验收的原提交补跑测试。检查通过后由 Symphony 继续原交付流程。

- AD-001，PR #15，提交 `a14839dbf0d3f691ea92cd70238532f8c5496130`
- AD-002，PR #17，提交 `87d22e150592a2a51a830fab63a86061308040aa`

## 范围
- 新建 `.github/workflows/ci.yml`，复用已有的项目测试。由面向 `main` 的 PR 和 `main` 推送触发检查。为 `agent/issue-*` 推送生成绑定分支实际提交的检查，确保首次引入工作流的修复 PR 自身也能取得检查结果。避免同一 worker 分支推送与 PR 更新重复执行整套检查。
- 用 `npm ci` 安装锁定依赖，执行 `npm run verify:fast` 和 `npm run verify:e2e`，按现有 Playwright 配置安装桌面 Chrome 和 WebKit。后端在 `team-server/` 用 runner 上的 Go 执行 `go test ./...`。macOS runner 在前端构建后执行 `cargo check --locked --manifest-path src-tauri/Cargo.toml`。
- 工作流进入 `main` 并完成主分支检查后，由 TimeManage 项目会话从 `main` 手动触发两次补跑。每次传入 PR 编号与上列完整 SHA。在运行前核对 PR 仍开放、来源为同仓库、目标为 `main`、头提交与已验收版本相同。按该 SHA 检出并运行同一套测试。结果必须关联该提交和实际 Actions 运行链接。
- 执行目标提交代码和发布状态使用独立作业。测试作业以只读权限运行，使用 GitHub 托管 runner，不提供项目密钥，不保留 checkout 凭证。仅从 `main` 发起的补跑发布作业获得 `statuses: write`，且不检出或执行目标提交的代码。发布前再次核对 PR 与提交；全部必需测试通过才可登记成功，失败或取消不得发布成功。
- CI 文件走独立 PR。保留两份原 PR 的提交与验收，不改业务代码、分支保护或部署配置。若 PR 提交变化或合并冲突需要新提交，按原交付流程核验新版本。

## 验收
- 证明 CI 修复分支的实际提交和合并后的 `main` 均产生真实检查。保存本地验证的通过、受控测试失败、恢复通过三组结果。输入 SHA 不匹配时拒绝补跑或发布状态。
- 分别提供 PR #15 和 #17 的完整 SHA、实际 Actions 运行链接及 GitHub 状态结果。成功结果必须绑定原提交，原验收沿用。后台核验满足合并条件后继续合并并检查主分支。任何失败保留记录并说明阻塞。

<!-- autodev-task:AD-003 -->
