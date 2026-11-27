import { useEffect, useRef, useState } from "react";
import type { Food } from "./catalog";
import { FoodArt } from "./PetArtwork";
import type { Mood } from "./PetPortrait";

export type Reaction = { kind: "pat" | "dress" | "say"; text: string } | { kind: "feed"; food: Food; text: string };
export const lines: Record<Mood, string> = {
  happy: "今天也一起加油呀！", focus: "嘘，我陪你专心。", hungry: "闻到点心的香味了…",
  crisis: "肚子咕噜咕噜…", eating: "好吃，再嚼一口！", dead: "去星星上散步了。",
};

export function usePetReaction() {
  const [reaction, set] = useState<(Reaction & { id: number })>();
  const sequence = useRef(0);
  useEffect(() => {
    if (!reaction) return;
    const id = window.setTimeout(() => set(undefined), 2400);
    return () => clearTimeout(id);
  }, [reaction]);
  return { reaction, play: (next: Reaction) => set({ ...next, id: ++sequence.current }), clear: () => set(undefined) };
}
export type ActiveReaction = ReturnType<typeof usePetReaction>["reaction"];

export function PetEffects({ reaction }: { reaction: ActiveReaction }) {
  if (!reaction) return null;
  return <div key={reaction.id} className={'pet-effects effect-' + reaction.kind} role="status">
    {reaction.kind === "feed" && <i className="pet-flying-food"><FoodArt food={reaction.food}/></i>}
    {(reaction.kind === "pat" || reaction.kind === "dress") && <i className="pet-sparks" aria-hidden="true">{reaction.kind === "pat" ? "♥　♡　♥" : "✦　✧　✦"}</i>}
    <span className="pet-speech">{reaction.text}</span>
  </div>;
}

export function EnergyBar({ value }: { value: number }) {
  return <div role="progressbar" aria-label="饱食度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.ceil(value)}
    className={'pet-energy ' + (value === 0 ? "critical" : value < 50 ? "low" : "")}><i style={{ width: value + "%" }}/></div>;
}
