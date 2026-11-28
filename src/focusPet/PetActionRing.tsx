import { useState, type CSSProperties } from "react";
import { Coins, HandHeart, House } from "lucide-react";
import { EnergyBar } from "./PetInteraction";
import { OwnedItems } from "./OwnedItems";
import type { PetState } from "./model";
import type { Item, ItemGestures } from "./useItemDrag";
import type { Shelf } from "./PetInventory";

export function PetActionRing({ fullness, state, busy, pat, open, shop, bind, useItem, style }: {
  fullness: number; state: PetState; busy: boolean; pat: () => void; open: () => void;
  shop: (shelf: Shelf) => void; bind: ItemGestures; useItem: (item: Item) => void; style: CSSProperties;
}) {
  const [shelf, setShelf] = useState<Shelf>("food");
  return <div className="pet-ring" role="group" aria-label="宠物快捷动作" style={style}>
    <div className="pet-mini-hud"><EnergyBar value={fullness}/><span><Coins size={13}/>{state.coins}</span></div>
    <div className="pet-dock-header"><div className="pet-shelves">{(["food", "clothes"] as const).map(id =>
      <button key={id} aria-pressed={shelf === id} onClick={() => setShelf(id)}>{id === "food" ? "食品" : "装扮"}</button>)}</div>
      <button onClick={pat} className="ring-pat"><HandHeart/>摸摸</button>
      <button onClick={open} aria-label="宠物小屋"><House/>小屋</button></div>
    <div className="pet-items" key={shelf}><OwnedItems {...{ state, busy, bind, useItem }} clothes={shelf === "clothes"}
      full={Math.ceil(fullness) >= 100} shop={() => shop(shelf)}/></div>
  </div>;
}
