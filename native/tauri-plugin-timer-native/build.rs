const COMMANDS: &[&str] = &["sync_timer", "start_audio", "stop_audio"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .build();
}
