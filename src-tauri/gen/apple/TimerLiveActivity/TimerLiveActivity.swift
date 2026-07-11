import ActivityKit
import SwiftUI
import WidgetKit
import TimerActivityModel

private let accent = Color(red: 0.10, green: 0.55, blue: 0.48)

private func modeLabel(_ mode: String) -> String {
  switch mode {
  case "focus": return "专注"
  case "short_break": return "短休息"
  case "long_break": return "长休息"
  default: return "计时"
  }
}

private struct TimerActivityView: View {
  let context: ActivityViewContext<TimeManageTimerAttributes>

  var body: some View {
    Link(destination: URL(string: "timemanage://focus")!) {
      HStack(spacing: 14) {
        VStack(alignment: .leading, spacing: 4) {
          Text(modeLabel(context.state.mode)).font(.caption).foregroundStyle(.secondary)
          Text(context.state.taskTitle).font(.headline).lineLimit(1)
        }
        Spacer(minLength: 8)
        if context.state.isRunning {
          Text(timerInterval: Date()...context.state.plannedEndAt, countsDown: true)
            .font(.system(.title2, design: .rounded, weight: .bold))
            .monospacedDigit()
        } else {
          Text(Duration.seconds(context.state.remaining).formatted(.time(pattern: .minuteSecond)))
            .font(.system(.title2, design: .rounded, weight: .bold))
            .monospacedDigit()
        }
      }
      .padding()
      .activityBackgroundTint(Color.white)
      .activitySystemActionForegroundColor(accent)
    }
  }
}

struct TimeManageTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TimeManageTimerAttributes.self) { context in
      TimerActivityView(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Text(modeLabel(context.state.mode)).foregroundStyle(accent)
        }
        DynamicIslandExpandedRegion(.trailing) {
          if context.state.isRunning {
            Text(timerInterval: Date()...context.state.plannedEndAt, countsDown: true).monospacedDigit()
          } else {
            Text("已暂停")
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.state.taskTitle).lineLimit(1)
        }
      } compactLeading: {
        Image(systemName: context.state.isRunning ? "timer" : "pause.fill").foregroundStyle(accent)
      } compactTrailing: {
        if context.state.isRunning {
          Text(timerInterval: Date()...context.state.plannedEndAt, countsDown: true).monospacedDigit()
        } else {
          Text("暂停")
        }
      } minimal: {
        Image(systemName: "timer").foregroundStyle(accent)
      }
      .widgetURL(URL(string: "timemanage://focus"))
      .keylineTint(accent)
    }
  }
}

@main
struct TimeManageLiveActivityBundle: WidgetBundle {
  var body: some Widget { TimeManageTimerLiveActivity() }
}
