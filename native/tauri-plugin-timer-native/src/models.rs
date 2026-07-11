use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimerActivityPayload {
  pub id: String,
  pub mode: String,
  pub task_title: String,
  pub is_running: bool,
  pub planned_end_at: String,
  pub remaining: u64,
  pub duration: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTimerRequest {
  pub payload: Option<TimerActivityPayload>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAudioRequest {
  pub kind: String,
  pub volume: f64,
}
