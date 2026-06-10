# macOS Strict Mode Plan

macOS 首版目标是屏蔽 App + 网站。Tauri/Rust 负责命令边界，原生层负责权限和系统集成。

## Native Responsibilities

- App monitoring: 使用辅助功能权限或 Workspace APIs 识别前台应用 bundle id。
- Website blocking: 优先评估 Network Extension/content filter；开发期可使用本地代理或 hosts 策略作为实验实现。
- Notifications: 专注开始、被拦截、作废和恢复时提供系统通知。

## Runtime States

- `unknown`: 尚未请求或无法判断权限。
- `granted`: 可以执行系统级拦截。
- `denied`: 用户拒绝权限，降级软严格模式。
- `unavailable`: 非 Apple 平台或当前构建未包含插件。

