import { TimerReset } from "lucide-react";

export function BootScreen() {
  return (
    <main className="boot">
      <div className="boot-mark">
        <TimerReset size={36} />
      </div>
      <p>正在加载 TimeManage...</p>
    </main>
  );
}
