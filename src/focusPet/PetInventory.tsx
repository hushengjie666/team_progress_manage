import { Backpack, Shirt, Store, Coins } from "lucide-react";
import { foods, outfits, slots, type Outfit } from "./catalog";
import type { PetHouseProps } from "./PetHouse";
import { FoodArt } from "./PetArtwork";
import { OwnedItems } from "./OwnedItems";
import type { ItemGestures } from "./useItemDrag";
import { PetPortrait } from "./PetPortrait";

const tabs = [
  { id: "bag", name: "背包喂食", Icon: Backpack },
  { id: "shop", name: "道具商店", Icon: Store },
  { id: "closet", name: "衣橱换装", Icon: Shirt },
] as const;
export type Section = typeof tabs[number]["id"];
export type Shelf = "food" | "clothes";

export function PetInventory({ state, busy, send, full, tab, shelf, select, preview, tryOn, bind }: Pick<PetHouseProps, "state" | "busy" | "send"> & {
  full: boolean; tab: Section; shelf: Shelf; select: (tab: Section, shelf?: Shelf) => void;
  bind: ItemGestures; preview?: Outfit; tryOn: (id?: Outfit) => void;
}) {
  if (!state.pet) return null;
  const animal = state.pet.species;
  const shop = tab === "shop";
  return <div className="pet-inventory">
    <div className="pet-tabs">{tabs.map(({ id, name, Icon }) => <button key={id} aria-pressed={tab === id}
      onClick={() => select(id)}><Icon size={17}/>{name}</button>)}</div>
    {shop && <div className="pet-shelves">{(["food", "clothes"] as const).map(id => <button key={id} aria-pressed={shelf === id}
      onClick={() => select("shop", id)}>{id === "food" ? "美食" : "服饰"}</button>)}</div>}
    <div className="pet-items" key={tab + shelf} tabIndex={0} aria-label="道具格">
      {!shop ? <OwnedItems {...{ state, busy, full, bind, preview, tryOn }} clothes={tab === "closet"}
        useItem={send} shop={() => select("shop", tab === "closet" ? "clothes" : "food")}/> : shelf === "food" ? <>
        {foods.map(item => <article className="pet-item" key={item.id}>
          <span className="pet-sticker"><Coins size={12}/> {item.price}</span>
          <FoodArt food={item.id}/><strong>{item.name}</strong><small>+{item.points} 饱食度</small>
          {state.coins < item.price && <small>还差 {item.price - state.coins} 金币</small>}
          <div className="pet-item-actions">
            <button disabled={busy || state.coins < item.price}
              onClick={() => void send({ kind: "buyFood", food: item.id, serve: false })}>存入背包</button>
            <button disabled={busy || full || state.coins < item.price}
              onClick={() => void send({ kind: "buyFood", food: item.id, serve: true })}>
              买下喂食</button>
          </div>
        </article>)}
        {full && <small className="pet-full">饱食度已满，稍后再喂食。</small>}
      </> : <>
        {outfits.map(item => {
          const owned = state.wardrobe.includes(item.id);
          const worn = state.wearing[item.slot] === item.id;
          return <article key={item.id} className="pet-item">
            <span className="pet-sticker">{slots[item.slot]}</span>
            <PetPortrait animal={animal} mood="happy" wearing={{ [item.slot]: item.id }}/>
            <strong>{item.name}</strong><small><Coins size={12}/> {item.price} 金币</small>
            <small className="pet-item-state">{worn ? "穿着中" : owned ? "已拥有" : state.coins < item.price ? "还差 " + (item.price - state.coins) + " 金币" : "可购买"}</small>
            <div className="pet-item-actions"><button aria-pressed={preview === item.id}
              onClick={() => tryOn(preview === item.id ? undefined : item.id)}>{preview === item.id ? "结束试穿" : "试穿"}</button>
              <button disabled={busy || owned || state.coins < item.price}
                onClick={() => void send({ kind: "buyOutfit", outfit: item.id })}>
                {owned ? "已购买" : "购买"}</button></div>
          </article>;
        })}
      </>}
    </div>
  </div>;
}
