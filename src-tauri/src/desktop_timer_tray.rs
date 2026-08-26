use serde::Deserialize;
use tauri::{
    menu::{Menu, MenuItem, MenuItemBuilder, PredefinedMenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    App, AppHandle, Emitter, Manager, Runtime,
};

const TIMER_TRAY_ID: &str = "timer-status";
const TIMER_TOGGLE_MENU_ID: &str = "timer-status-toggle";
const TIMER_ABORT_MENU_ID: &str = "timer-status-abort";
const TIMER_OPEN_MENU_ID: &str = "timer-status-open";
const TIMER_TOGGLE_EVENT: &str = "desktop-timer:toggle";
const TIMER_ABORT_EVENT: &str = "desktop-timer:abort";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopTimerStatusPayload {
    mode: String,
    duration: u64,
    remaining: u64,
    is_running: bool,
    prepared: Option<bool>,
    task_title: Option<String>,
    actual_pomodoros: Option<u32>,
    estimate_pomodoros: Option<u32>,
}

struct DesktopTimerTray<R: Runtime> {
    tray: TrayIcon<R>,
    header_item: MenuItem<R>,
    task_item: MenuItem<R>,
    pomodoro_item: MenuItem<R>,
    progress_item: MenuItem<R>,
    toggle_item: MenuItem<R>,
    abort_item: MenuItem<R>,
}

fn format_time(remaining: u64) -> String {
    format!("{:02}:{:02}", remaining / 60, remaining % 60)
}

fn mode_label(mode: &str) -> &'static str {
    match mode {
        "short_break" => "短休息",
        "long_break" => "阶段休息",
        _ => "专注番茄",
    }
}

fn status_title(payload: &DesktopTimerStatusPayload) -> String {
    let marker = if payload.is_running {
        match payload.mode.as_str() {
            "focus" => "🍅",
            _ => "☕",
        }
    } else {
        "⏸"
    };
    format!("{marker} {}", format_time(payload.remaining))
}

fn header_text(payload: &DesktopTimerStatusPayload) -> String {
    format!(
        "{} · {}",
        mode_label(&payload.mode),
        format_time(payload.remaining)
    )
}

fn task_text(payload: &DesktopTimerStatusPayload) -> String {
    let title = payload
        .task_title
        .as_deref()
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .unwrap_or("无任务计时");
    format!("任务：{title}")
}

fn pomodoro_text(payload: &DesktopTimerStatusPayload) -> String {
    match (payload.actual_pomodoros, payload.estimate_pomodoros) {
        (Some(actual), Some(estimate)) => format!("番茄：{actual}/{estimate}"),
        _ => "番茄：—".to_string(),
    }
}

fn progress_text(payload: &DesktopTimerStatusPayload) -> String {
    let percent = if payload.duration == 0 {
        0
    } else {
        payload
            .duration
            .saturating_sub(payload.remaining)
            .saturating_mul(100)
            / payload.duration
    }
    .min(100);
    let filled = (percent / 10) as usize;
    format!(
        "计时进度：{}{} {percent}%",
        "━".repeat(filled),
        "─".repeat(10 - filled)
    )
}

fn toggle_text(payload: &DesktopTimerStatusPayload) -> &'static str {
    if payload.is_running {
        "暂停"
    } else if payload.prepared.unwrap_or(false) {
        "开始"
    } else {
        "继续"
    }
}

pub(crate) fn setup<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let header_item = MenuItemBuilder::new("TimeManage 计时器")
        .enabled(false)
        .build(app)?;
    let task_item = MenuItemBuilder::new("任务：—").enabled(false).build(app)?;
    let pomodoro_item = MenuItemBuilder::new("番茄：—").enabled(false).build(app)?;
    let progress_item = MenuItemBuilder::new("计时进度：────────── 0%")
        .enabled(false)
        .build(app)?;
    let toggle_item = MenuItemBuilder::with_id(TIMER_TOGGLE_MENU_ID, "暂停").build(app)?;
    let abort_item = MenuItemBuilder::with_id(TIMER_ABORT_MENU_ID, "作废番茄").build(app)?;
    let open_item = MenuItemBuilder::with_id(TIMER_OPEN_MENU_ID, "打开 TimeManage").build(app)?;
    let first_separator = PredefinedMenuItem::separator(app)?;
    let second_separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &header_item,
            &task_item,
            &pomodoro_item,
            &progress_item,
            &first_separator,
            &toggle_item,
            &abort_item,
            &second_separator,
            &open_item,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TIMER_TRAY_ID)
        .menu(&menu)
        .tooltip("TimeManage 计时器")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TIMER_TOGGLE_MENU_ID => {
                let _ = app.emit_to("main", TIMER_TOGGLE_EVENT, ());
            }
            TIMER_ABORT_MENU_ID => {
                let _ = app.emit_to("main", TIMER_ABORT_EVENT, ());
            }
            TIMER_OPEN_MENU_ID => super::restore_main_window_on_main_thread(app),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    let tray = builder.build(app)?;
    tray.set_visible(false)?;

    app.manage(DesktopTimerTray {
        tray,
        header_item,
        task_item,
        pomodoro_item,
        progress_item,
        toggle_item,
        abort_item,
    });
    Ok(())
}

pub(crate) fn sync<R: Runtime>(
    app: &AppHandle<R>,
    payload: Option<DesktopTimerStatusPayload>,
) -> Result<(), String> {
    let tray = app.state::<DesktopTimerTray<R>>();
    let Some(payload) = payload else {
        tray.tray
            .set_title::<&str>(None)
            .map_err(|error| error.to_string())?;
        tray.tray
            .set_visible(false)
            .map_err(|error| error.to_string())?;
        return Ok(());
    };

    let title = status_title(&payload);
    tray.header_item
        .set_text(header_text(&payload))
        .map_err(|error| error.to_string())?;
    tray.task_item
        .set_text(task_text(&payload))
        .map_err(|error| error.to_string())?;
    tray.pomodoro_item
        .set_text(pomodoro_text(&payload))
        .map_err(|error| error.to_string())?;
    tray.progress_item
        .set_text(progress_text(&payload))
        .map_err(|error| error.to_string())?;
    tray.toggle_item
        .set_text(toggle_text(&payload))
        .map_err(|error| error.to_string())?;
    tray.abort_item
        .set_enabled(true)
        .map_err(|error| error.to_string())?;
    tray.tray
        .set_title(Some(&title))
        .map_err(|error| error.to_string())?;
    tray.tray
        .set_tooltip(Some(format!(
            "{} · {}",
            header_text(&payload),
            task_text(&payload)
        )))
        .map_err(|error| error.to_string())?;
    tray.tray
        .set_visible(true)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload() -> DesktopTimerStatusPayload {
        DesktopTimerStatusPayload {
            mode: "focus".to_string(),
            duration: 100,
            remaining: 79,
            is_running: true,
            prepared: Some(false),
            task_title: Some("梳理现有出口细分方案".to_string()),
            actual_pomodoros: Some(6),
            estimate_pomodoros: Some(3),
        }
    }

    #[test]
    fn formats_status_bar_timer_information() {
        let payload = payload();
        assert_eq!(format_time(payload.remaining), "01:19");
        assert_eq!(status_title(&payload), "🍅 01:19");
        assert_eq!(header_text(&payload), "专注番茄 · 01:19");
        assert_eq!(task_text(&payload), "任务：梳理现有出口细分方案");
        assert_eq!(pomodoro_text(&payload), "番茄：6/3");
        assert_eq!(progress_text(&payload), "计时进度：━━──────── 21%");
        assert_eq!(toggle_text(&payload), "暂停");
    }

    #[test]
    fn labels_paused_and_prepared_timer_actions() {
        let mut payload = payload();
        payload.is_running = false;
        assert_eq!(status_title(&payload), "⏸ 01:19");
        assert_eq!(toggle_text(&payload), "继续");
        payload.prepared = Some(true);
        assert_eq!(toggle_text(&payload), "开始");
    }
}
