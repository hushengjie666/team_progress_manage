use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::TimerNative;
#[cfg(mobile)]
use mobile::TimerNative;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the timer-native APIs.
pub trait TimerNativeExt<R: Runtime> {
  fn timer_native(&self) -> &TimerNative<R>;
}

impl<R: Runtime, T: Manager<R>> crate::TimerNativeExt<R> for T {
  fn timer_native(&self) -> &TimerNative<R> {
    self.state::<TimerNative<R>>().inner()
  }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("timer-native")
    .invoke_handler(tauri::generate_handler![commands::sync_timer, commands::start_audio, commands::stop_audio])
    .setup(|app, api| {
      #[cfg(mobile)]
      let timer_native = mobile::init(app, api)?;
      #[cfg(desktop)]
      let timer_native = desktop::init(app, api)?;
      app.manage(timer_native);
      Ok(())
    })
    .build()
}
