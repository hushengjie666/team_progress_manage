use rusqlite::{params, Connection};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize)]
struct StrictModeStatus {
    active: bool,
    platform: String,
    permission_state: String,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct StrictCheckResult {
    platform: String,
    app_name: Option<String>,
    url: Option<String>,
    matched: bool,
    matched_type: Option<String>,
    matched_value: Option<String>,
    message: String,
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法读取应用数据目录: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("无法创建应用数据目录: {error}"))?;
    Ok(dir.join("timemanage.sqlite3"))
}

fn runtime_platform() -> &'static str {
    match std::env::consts::OS {
        "macos" => "tauri_macos",
        "ios" => "ios",
        _ => "browser",
    }
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    let connection = Connection::open(path).map_err(|error| format!("无法打开 SQLite: {error}"))?;
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS app_state (
                id TEXT PRIMARY KEY NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sync_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                synced_at TEXT
            );
            ",
        )
        .map_err(|error| format!("无法初始化 SQLite schema: {error}"))?;
    Ok(connection)
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("SELECT payload FROM app_state WHERE id = 'default'")
        .map_err(|error| format!("无法准备读取状态: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("无法查询状态: {error}"))?;

    match rows
        .next()
        .map_err(|error| format!("无法读取状态行: {error}"))?
    {
        Some(row) => row
            .get::<_, String>(0)
            .map(Some)
            .map_err(|error| format!("无法解析状态: {error}")),
        None => Ok(None),
    }
}

#[tauri::command]
fn save_state(app: AppHandle, payload: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&payload)
        .map_err(|error| format!("状态不是合法 JSON: {error}"))?;
    let connection = open_database(&app)?;
    let updated_at = chrono::Utc::now().to_rfc3339();
    connection
        .execute(
            "
            INSERT INTO app_state (id, payload, updated_at)
            VALUES ('default', ?1, ?2)
            ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
            ",
            params![payload, updated_at],
        )
        .map_err(|error| format!("无法保存状态: {error}"))?;
    Ok(())
}

#[tauri::command]
fn request_strict_permissions() -> StrictModeStatus {
    let platform = runtime_platform().to_string();
    if platform == "tauri_macos" {
        StrictModeStatus {
            active: false,
            platform,
            permission_state: "unknown".to_string(),
            message: "macOS 严格模式需要屏幕使用时间/辅助功能/网络过滤等原生权限；当前已提供插件边界，尚未绑定系统授权 UI。".to_string(),
        }
    } else if platform == "ios" {
        StrictModeStatus {
            active: false,
            platform,
            permission_state: "unknown".to_string(),
            message: "iOS 构建将通过 FamilyControls、ManagedSettings 和 DeviceActivity 请求屏幕时间权限。".to_string(),
        }
    } else {
        StrictModeStatus {
            active: false,
            platform,
            permission_state: "unavailable".to_string(),
            message: "首版系统级严格模式 Apple 优先；此平台会降级为软严格模式。".to_string(),
        }
    }
}

#[tauri::command]
fn start_strict_mode(profile_json: String) -> StrictModeStatus {
    let platform = runtime_platform().to_string();
    let profile_summary = serde_json::from_str::<serde_json::Value>(&profile_json)
        .ok()
        .and_then(|value| {
            value
                .get("name")
                .and_then(|name| name.as_str())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| "默认方案".to_string());

    if platform == "tauri_macos" || platform == "ios" {
        StrictModeStatus {
            active: true,
            platform,
            permission_state: "unknown".to_string(),
            message: format!(
                "已进入 {profile_summary} 严格模式边界；真实 App/网站屏蔽由 Apple 原生插件接管。"
            ),
        }
    } else {
        StrictModeStatus {
            active: true,
            platform,
            permission_state: "unavailable".to_string(),
            message: format!("已进入 {profile_summary} 软严格模式；当前平台不执行系统级屏蔽。"),
        }
    }
}

#[tauri::command]
fn stop_strict_mode() -> StrictModeStatus {
    StrictModeStatus {
        active: false,
        platform: runtime_platform().to_string(),
        permission_state: "unknown".to_string(),
        message: "严格模式已停止，屏蔽配置已释放。".to_string(),
    }
}

fn escape_applescript(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn run_applescript(script: &str) -> Option<String> {
    let output = Command::new("osascript").arg("-e").arg(script).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn current_front_app() -> Option<String> {
    run_applescript("tell application \"System Events\" to get name of first application process whose frontmost is true")
}

fn current_browser_url(app_name: &str) -> Option<String> {
    let lower = app_name.to_lowercase();
    if lower.contains("chrome") {
        return run_applescript(
            "tell application \"Google Chrome\" to if (count of windows) > 0 then get URL of active tab of front window",
        );
    }
    if lower.contains("safari") {
        return run_applescript(
            "tell application \"Safari\" to if (count of windows) > 0 then get URL of current tab of front window",
        );
    }
    None
}

fn list_from_profile(profile: &serde_json::Value, key: &str) -> Vec<String> {
    profile
        .get(key)
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_lowercase())
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
fn check_strict_violation(profile_json: String) -> StrictCheckResult {
    let platform = runtime_platform().to_string();
    if platform != "tauri_macos" {
        return StrictCheckResult {
            platform,
            app_name: None,
            url: None,
            matched: false,
            matched_type: None,
            matched_value: None,
            message: "当前平台不支持前台 App/URL 软检测。".to_string(),
        };
    }

    let profile = serde_json::from_str::<serde_json::Value>(&profile_json).unwrap_or(serde_json::Value::Null);
    let blocked_apps = list_from_profile(&profile, "apps");
    let blocked_websites = list_from_profile(&profile, "websites");
    let app_name = current_front_app();
    let url = app_name.as_deref().and_then(current_browser_url);
    let lower_app = app_name.clone().unwrap_or_default().to_lowercase();
    if let Some(blocked) = blocked_apps
        .iter()
        .find(|blocked| !blocked.is_empty() && lower_app.contains(blocked.as_str()))
    {
        return StrictCheckResult {
            platform,
            app_name,
            url,
            matched: true,
            matched_type: Some("app".to_string()),
            matched_value: Some(blocked.clone()),
            message: "检测到屏蔽 App。".to_string(),
        };
    }
    let lower_url = url.clone().unwrap_or_default().to_lowercase();
    if let Some(blocked) = blocked_websites
        .iter()
        .find(|blocked| !blocked.is_empty() && lower_url.contains(blocked.as_str()))
    {
        return StrictCheckResult {
            platform,
            app_name,
            url,
            matched: true,
            matched_type: Some("website".to_string()),
            matched_value: Some(blocked.clone()),
            message: "检测到屏蔽网站。".to_string(),
        };
    }

    StrictCheckResult {
        platform,
        app_name,
        url,
        matched: false,
        matched_type: None,
        matched_value: None,
        message: "未检测到屏蔽项。".to_string(),
    }
}

#[tauri::command]
fn request_timer_notifications() -> StrictModeStatus {
    let platform = runtime_platform().to_string();
    if platform == "tauri_macos" {
        StrictModeStatus {
            active: true,
            platform,
            permission_state: "unknown".to_string(),
            message: "macOS 通知将通过系统通知中心发送；首次发送时由系统处理授权。".to_string(),
        }
    } else if platform == "ios" {
        StrictModeStatus {
            active: true,
            platform,
            permission_state: "unknown".to_string(),
            message: "iOS 构建会使用系统本地通知能力；真实授权在移动端构建中完成。".to_string(),
        }
    } else {
        StrictModeStatus {
            active: false,
            platform,
            permission_state: "unavailable".to_string(),
            message: "当前平台未接入原生通知，前端会尝试 Web Notification fallback。".to_string(),
        }
    }
}

#[tauri::command]
fn send_timer_notification(title: String, body: String) -> Result<(), String> {
    let platform = runtime_platform();
    if platform == "tauri_macos" {
        let script = format!(
            "display notification \"{}\" with title \"{}\"",
            escape_applescript(&body),
            escape_applescript(&title)
        );
        let status = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .status()
            .map_err(|error| format!("无法发送 macOS 通知: {error}"))?;
        if !status.success() {
            return Err("macOS 通知命令执行失败".to_string());
        }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            request_strict_permissions,
            start_strict_mode,
            stop_strict_mode,
            check_strict_violation,
            request_timer_notifications,
            send_timer_notification
        ])
        .run(tauri::generate_context!())
        .expect("error while running TimeManage application");
}
