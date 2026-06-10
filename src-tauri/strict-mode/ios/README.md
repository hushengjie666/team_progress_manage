# iOS Strict Mode Plan

该目录记录 iOS 原生严格模式的实现边界。首版 Tauri 命令已经预留接口，后续添加 Swift plugin 时按以下职责接入。

## Frameworks

- `FamilyControls`: 展示系统选择器，让用户选择要屏蔽的 App、类别和网站。
- `ManagedSettings`: 在专注番茄开始时启用 shield，结束/作废时释放 shield。
- `DeviceActivity`: 监听专注时段和跨进程状态，保障应用被切走后仍能执行限制。

## Plugin Methods

- `requestAuthorization() -> PermissionState`
- `presentFamilyActivityPicker() -> BlockProfileSelection`
- `startShield(profileId, apps, websites, until)`
- `stopShield(profileId)`

## Fallback

如果用户拒绝权限，前端保持软严格模式：退出确认、失败记录、奖励中断，不阻断系统 App。

