# Strict Mode Native Boundary

首版产品使用 Tauri 统一应用壳、React 统一界面、SQLite 做本地优先数据。系统级屏蔽不在 WebView 中实现，而由 Apple 平台原生插件接管。

## Current Contract

前端只调用三条命令：

- `request_strict_permissions`
- `start_strict_mode(profileJson)`
- `stop_strict_mode`

这些命令现在提供可运行的降级状态，后续接入 iOS/macOS 原生实现时保持前端 API 不变。

## Apple Scope

- iOS: `FamilyControls` 选择 App/网站，`ManagedSettings` 应用屏蔽，`DeviceActivity` 监听时段。
- macOS: 辅助功能权限识别前台 App，Network Extension 或内容过滤策略处理网站屏蔽。
- 数据策略: 只保存用户选择的 bundle/domain 标识和权限状态，不采集完整屏幕使用明细。

