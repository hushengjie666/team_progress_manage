import { Sparkles } from "lucide-react";
import type { NativeCapabilityState } from "../../types";

export function SettingsSystemPanel({ nativeCapabilities }: { nativeCapabilities: NativeCapabilityState[] }) {
  return (
    <section className="band settings-panel native-roadmap">
      <div className="section-title">
        <div>
          <p className="eyebrow">系统环境</p>
          <h2>跨端能力状态</h2>
        </div>
        <Sparkles size={20} />
      </div>
      <div className="capability-grid">
        {nativeCapabilities.map((capability) => (
          <article className="capability-item" key={capability.platform}>
            <strong>{capability.label}</strong>
            <span>{capability.available ? "当前可用/可验收" : "适配层已保留"}</span>
            <p>{capability.fallback}</p>
            <small>{capability.capabilities.join(" · ")}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
