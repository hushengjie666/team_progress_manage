use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_timer_native);

// initializes the Kotlin or Swift plugin classes
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<TimerNative<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin("", "ExamplePlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_timer_native)?;
  Ok(TimerNative(handle))
}

/// Access to the timer-native APIs.
pub struct TimerNative<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> TimerNative<R> {
  pub fn sync_timer(&self, request: SyncTimerRequest) -> crate::Result<()> {
    self.0.run_mobile_plugin("syncTimer", request).map_err(Into::into)
  }

  pub fn start_audio(&self, request: StartAudioRequest) -> crate::Result<()> {
    self.0.run_mobile_plugin("startAudio", request).map_err(Into::into)
  }

  pub fn stop_audio(&self) -> crate::Result<()> {
    self.0.run_mobile_plugin("stopAudio", ()).map_err(Into::into)
  }
}
