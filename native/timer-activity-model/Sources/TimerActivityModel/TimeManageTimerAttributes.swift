import ActivityKit
import Foundation

public struct TimeManageTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    public let taskTitle: String
    public let mode: String
    public let isRunning: Bool
    public let plannedEndAt: Date
    public let remaining: Int
    public let duration: Int

    public init(taskTitle: String, mode: String, isRunning: Bool, plannedEndAt: Date, remaining: Int, duration: Int) {
      self.taskTitle = taskTitle
      self.mode = mode
      self.isRunning = isRunning
      self.plannedEndAt = plannedEndAt
      self.remaining = remaining
      self.duration = duration
    }
  }

  public let sessionId: String

  public init(sessionId: String) {
    self.sessionId = sessionId
  }
}
