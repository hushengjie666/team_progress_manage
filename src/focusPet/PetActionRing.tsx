import { Coins, Cookie, HandHeart, House } from "lucide-react";
import { EnergyBar } from "./PetInteraction";

export function PetActionRing({ fullness, coins, busy, hasFood, pat, feed, open }: {
  fullness: number; coins: number; busy: boolean; hasFood: boolean; pat: () => void; feed: () => void; open: () => void;
}) {
  return <div className="pet-ring" role="group" aria-label="宠物快捷动作">
    <button onClick={pat} className="ring-pat"><HandHeart/>摸摸</button>
    <button onClick={feed} className="ring-feed" disabled={busy || (hasFood && Math.ceil(fullness) >= 100)}><Cookie/>快捷喂食</button>
    <button onClick={open} className="ring-house"><House/>宠物小屋</button>
    <div className="pet-mini-hud"><EnergyBar value={fullness}/><span><Coins size={12}/>{coins}</span></div>
  </div>;
}
