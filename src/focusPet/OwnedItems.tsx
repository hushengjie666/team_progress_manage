import { Backpack, Shirt } from "lucide-react";
import { foods, outfits, slots, type Outfit } from "./catalog";
import { FoodArt } from "./PetArtwork";
import { OutfitArt } from "./PetPortrait";
import type { PetState } from "./model";
import type { Item, ItemGestures } from "./useItemDrag";

type Props = {
  state: PetState; busy: boolean; full: boolean; clothes: boolean; bind: ItemGestures;
  useItem: (item: Item) => void; shop: () => void; preview?: Outfit; tryOn?: (id?: Outfit) => void;
};
export function OwnedItems({ state, busy, full, clothes, bind, useItem, shop, preview, tryOn }: Props) {
  const available = clothes ? outfits.filter(item => state.wardrobe.includes(item.id)) : foods.filter(item => state.bag[item.id]);
  if (!available.length) return <div className="pet-empty">{clothes ? <Shirt/> : <Backpack/>}
    <p>{clothes ? "衣橱还是空的" : "背包里还没有食物"}</p>
    <button onClick={shop}>{clothes ? "挑件新衣" : "去买点心"}</button></div>;
  return <>{available.map(item => {
    const fit = "slot" in item;
    const worn = fit && state.wearing[item.slot] === item.id;
    const action: Item = fit ? { kind: "wear", outfit: item.id } : { kind: "feed", food: item.id };
    const disabled = busy || (!fit && full);
    return <article key={item.id} className="pet-item pet-owned" {...bind(action)}>
      <button className="pet-item-use" aria-label={item.name + (fit ? worn ? " 卸下" : " 穿戴" : " 喂食")}
        aria-disabled={disabled} onClick={() => { if (!disabled) useItem(action); }}>
        <span className="pet-sticker">{fit ? slots[item.slot] : "×" + state.bag[item.id]}</span>
        {fit ? <OutfitArt outfit={item}/> : <FoodArt food={item.id}/>}
        <strong>{item.name}</strong>
        <small>{fit ? worn ? "穿着中" : "已拥有" : "+" + item.points + " 饱食度"}</small>
        <span className="pet-use-label">{fit ? worn ? "卸下" : "穿戴" : "喂食"}</span>
      </button>
      {fit && tryOn && <button className="pet-try-on" aria-pressed={preview === item.id}
        onClick={() => tryOn(preview === item.id ? undefined : item.id)}>{preview === item.id ? "结束试穿" : "试穿"}</button>}
    </article>;
  })}</>;
}
