use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<TimerNative<R>> {
  Ok(TimerNative(app.clone()))
}

/// Access to the timer-native APIs.
pub struct TimerNative<R: Runtime>(AppHandle<R>);

impl<R: Runtime> TimerNative<R> {
  pub fn sync_timer(&self, _request: SyncTimerRequest) -> crate::Result<()> { Ok(()) }
  pub fn start_audio(&self, _request: StartAudioRequest) -> crate::Result<()> { Ok(()) }
  pub fn stop_audio(&self) -> crate::Result<()> { Ok(()) }
}
