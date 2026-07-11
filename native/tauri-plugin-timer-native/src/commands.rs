use tauri::{AppHandle, command, Runtime};

use crate::models::*;
use crate::Result;
use crate::TimerNativeExt;

#[command]
pub(crate) async fn sync_timer<R: Runtime>(
    app: AppHandle<R>,
    request: SyncTimerRequest,
) -> Result<()> {
    app.timer_native().sync_timer(request)
}

#[command]
pub(crate) async fn start_audio<R: Runtime>(app: AppHandle<R>, request: StartAudioRequest) -> Result<()> {
    app.timer_native().start_audio(request)
}

#[command]
pub(crate) async fn stop_audio<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.timer_native().stop_audio()
}
