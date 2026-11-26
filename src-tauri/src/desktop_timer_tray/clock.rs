use super::{render_time, DesktopTimerStatusPayload, DesktopTimerTray};
use std::{
    sync::{mpsc, Arc},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, Runtime};

impl DesktopTimerStatusPayload {
    pub(super) fn remaining_at(&self, now_ms: u64) -> u64 {
        match self.deadline_ms.filter(|_| self.is_running) {
            Some(end) => (((end.saturating_sub(now_ms) as f64 / 1000.0) * self.speed_multiplier)
                .ceil() as u64)
                .min(self.duration),
            None => self.remaining,
        }
    }

    pub(super) fn remaining_now(&self) -> u64 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        self.remaining_at(now.as_millis() as u64)
    }
}

// The webview owns transitions and settlement. Only project its deadline while hidden.
pub(super) fn start_ticks<R: Runtime>(
    app: AppHandle<R>,
    source: Arc<DesktopTimerStatusPayload>,
    mut last_remaining: u64,
) {
    thread::spawn(move || loop {
        // At most one redraw is queued, including while the main run loop is tracking a menu.
        thread::sleep(Duration::from_millis(200));
        let remaining = source.remaining_now();
        let tray = app.state::<DesktopTimerTray<R>>();
        if !tray.is_current(&source) {
            break;
        }
        if remaining == last_remaining && remaining > 0 {
            continue;
        }
        let handle = app.clone();
        let timer = source.clone();
        let (reply, rendered) = mpsc::channel();
        if app
            .run_on_main_thread(move || {
                let tray = handle.state::<DesktopTimerTray<R>>();
                if !tray.is_current(&timer) {
                    return;
                }
                let remaining = timer.remaining_now();
                if let Err(error) = render_time(&tray, &timer, remaining) {
                    log::warn!("Failed to update timer menu: {error}");
                }
                if remaining == 0 {
                    let _ = handle.emit_to("main", "desktop-timer:expired", &timer.session_id);
                }
                let _ = reply.send(remaining);
            })
            .is_err()
        {
            break;
        }
        match rendered.recv() {
            Ok(0) | Err(_) => break,
            Ok(seconds) => last_remaining = seconds,
        }
    });
}
