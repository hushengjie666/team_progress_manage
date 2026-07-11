import ActivityKit
import AVFoundation
import SwiftRs
import Tauri
import TimerActivityModel
import UIKit
import WebKit

private struct TimerPayload: Decodable {
  let id: String
  let mode: String
  let taskTitle: String
  let isRunning: Bool
  let plannedEndAt: String
  let remaining: Int
  let duration: Int
}

private struct SyncTimerArgs: Decodable { let payload: TimerPayload? }
private struct StartAudioArgs: Decodable { let kind: String; let volume: Double }

final class TimerNativePlugin: Plugin {
  private var audioEngine: AVAudioEngine?
  private var noiseSource: AVAudioSourceNode?
  private var activeNoise: (kind: String, volume: Double)?

  override func load(webview: WKWebView) {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAudioInterruption(_:)),
      name: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance()
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc public func syncTimer(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SyncTimerArgs.self)
    Task { @MainActor in
      do {
        if #available(iOS 16.2, *) {
          try await self.updateActivity(args.payload)
        }
        invoke.resolve()
      } catch {
        invoke.reject(error.localizedDescription)
      }
    }
  }

  @objc public func startAudio(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(StartAudioArgs.self)
    do {
      try startNoise(kind: args.kind, volume: args.volume)
      invoke.resolve()
    } catch {
      invoke.reject(error.localizedDescription)
    }
  }

  @objc public func stopAudio(_ invoke: Invoke) {
    stopNoise()
    invoke.resolve()
  }

  @MainActor
  @available(iOS 16.2, *)
  private func updateActivity(_ payload: TimerPayload?) async throws {
    guard let payload else {
      for activity in Activity<TimeManageTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      return
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let endAt = formatter.date(from: payload.plannedEndAt) ?? Date().addingTimeInterval(TimeInterval(payload.remaining))
    let state = TimeManageTimerAttributes.ContentState(
      taskTitle: payload.taskTitle,
      mode: payload.mode,
      isRunning: payload.isRunning,
      plannedEndAt: endAt,
      remaining: payload.remaining,
      duration: payload.duration
    )
    let content = ActivityContent(state: state, staleDate: endAt.addingTimeInterval(60))
    if let activity = Activity<TimeManageTimerAttributes>.activities.first(where: { $0.attributes.sessionId == payload.id }) {
      await activity.update(content)
      return
    }
    for activity in Activity<TimeManageTimerAttributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    _ = try Activity.request(attributes: TimeManageTimerAttributes(sessionId: payload.id), content: content)
  }

  private func startNoise(kind: String, volume: Double) throws {
    stopNoise(clearSelection: false)
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
    try session.setActive(true)
    let engine = AVAudioEngine()
    let format = engine.outputNode.inputFormat(forBus: 0)
    let gain = Float(max(0, min(1, volume / 100))) * 0.3
    var previous: Float = 0
    let source = AVAudioSourceNode { _, _, frameCount, audioBufferList -> OSStatus in
      let buffers = UnsafeMutableAudioBufferListPointer(audioBufferList)
      for frame in 0..<Int(frameCount) {
        let white = Float.random(in: -1...1)
        let sample: Float
        if kind == "brown" {
          previous = (previous + 0.02 * white) / 1.02
          sample = previous * 3.5 * gain
        } else if kind == "rain" {
          sample = white * (frame % 7 == 0 ? 0.8 : 0.22) * gain
        } else {
          sample = white * 0.28 * gain
        }
        for buffer in buffers {
          buffer.mData?.assumingMemoryBound(to: Float.self)[frame] = sample
        }
      }
      return noErr
    }
    engine.attach(source)
    engine.connect(source, to: engine.mainMixerNode, format: format)
    try engine.start()
    audioEngine = engine
    noiseSource = source
    activeNoise = (kind, volume)
  }

  private func stopNoise(clearSelection: Bool = true) {
    audioEngine?.stop()
    if let source = noiseSource { audioEngine?.detach(source) }
    noiseSource = nil
    audioEngine = nil
    if clearSelection { activeNoise = nil }
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }

  @objc private func handleAudioInterruption(_ notification: Notification) {
    guard
      let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
      let type = AVAudioSession.InterruptionType(rawValue: rawType)
    else { return }
    if type == .began {
      audioEngine?.pause()
      return
    }
    let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
    guard AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume),
          let activeNoise else { return }
    try? startNoise(kind: activeNoise.kind, volume: activeNoise.volume)
  }
}

@_cdecl("init_plugin_timer_native")
func initPlugin() -> Plugin { TimerNativePlugin() }
