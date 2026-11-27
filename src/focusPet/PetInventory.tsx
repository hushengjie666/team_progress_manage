import { Backpack, Shirt, Store, Coins } from "lucide-react";
import { foods, outfits, slots, type Outfit } from "./catalog";
import type { PetHouseProps } from "./PetHouse";
import { FoodArt } from "./PetArtwork";
import { PetPortrait } from "./PetPortrait";

const tabs = [
  { id: "bag", name: "背包喂食", Icon: Backpack },
  { id: "shop", name: "道具商店", Icon: Store },
  { id: "closet", name: "衣橱换装", Icon: Shirt },
] as const;
export type Section = typeof tabs[number]["id"];
export type Shelf = "food" | "clothes";

export function PetInventory({ state, busy, send, full, tab, shelf, select, preview, tryOn }: Pick<PetHouseProps, "state" | "busy" | "send"> & {
  full: boolean; tab: Section; shelf: Shelf; select: (tab: Section, shelf?: Shelf) => void;
  preview?: Outfit; tryOn: (id?: Outfit) => void;
}) {
  if (!state.pet) return null;
  const animal = state.pet.species;
  const shop = tab === "shop";
  const foodItems = foods.filter(item => shop || state.bag[item.id]);
  const clothes = outfits.filter(item => shop || state.wardrobe.includes(item.id));
  return <div className="pet-inventory">
    <div className="pet-tabs">{tabs.map(({ id, name, Icon }) => <button key={id} aria-pressed={tab === id}
      onClick={() => select(id)}><Icon size={17}/>{name}</button>)}</div>
    {shop && <div className="pet-shelves">{(["food", "clothes"] as const).map(id => <button key={id} aria-pressed={shelf === id}
      onClick={() => select("shop", id)}>{id === "food" ? "美食" : "服饰"}</button>)}</div>}
    <div className="pet-items" key={tab + shelf} tabIndex={0} aria-label="道具格">
      {tab === "bag" || (shop && shelf === "food") ? <>
        {foodItems.map(item => <article className="pet-item" key={item.id}>
          <span className="pet-sticker">{shop ? <><Coins size={12}/> {item.price}</> : "×" + state.bag[item.id]}</span>
          <FoodArt food={item.id}/><strong>{item.name}</strong><small>+{item.points} 饱食度</small>
          {shop && state.coins < item.price && <small>还差 {item.price - state.coins} 金币</small>}
          <div className="pet-item-actions">
            {shop && <button disabled={busy || state.coins < item.price}
              onClick={() => void send({ kind: "buyFood", food: item.id, serve: false })}>存入背包</button>}
            <button disabled={busy || full || (shop && state.coins < item.price)}
              onClick={() => void send(shop ? { kind: "buyFood", food: item.id, serve: true } : { kind: "feed", food: item.id })}>
              {shop ? "买下喂食" : "喂食"}</button>
          </div>
        </article>)}
        {!foodItems.length && <div className="pet-empty"><Backpack/><p>背包里还没有食物</p><small>每专注一分钟，攒一枚金币。</small><button onClick={() => select("shop", "food")}>去买点心</button></div>}
        {full && <small className="pet-full">饱食度已满，稍后再喂食。</small>}
      </> : <>
        {!clothes.length && <div className="pet-empty"><Shirt/><p>衣橱还是空的</p><button onClick={() => select("shop", "clothes")}>挑件新衣</button></div>}
        {clothes.map(item => {
          const owned = state.wardrobe.includes(item.id);
          const worn = state.wearing[item.slot] === item.id;
          return <article key={item.id} className="pet-item">
            <span className="pet-sticker">{slots[item.slot]}</span>
            <PetPortrait animal={animal} mood="happy" wearing={{ [item.slot]: item.id }}/>
            <strong>{item.name}</strong><small><Coins size={12}/> {item.price} 金币</small>
            <small className="pet-item-state">{worn ? "穿着中" : owned ? "已拥有" : state.coins < item.price ? "还差 " + (item.price - state.coins) + " 金币" : "可购买"}</small>
            <div className="pet-item-actions"><button aria-pressed={preview === item.id}
              onClick={() => tryOn(preview === item.id ? undefined : item.id)}>{preview === item.id ? "结束试穿" : "试穿"}</button>
              <button disabled={busy || (shop && (owned || state.coins < item.price))}
                onClick={() => void send({ kind: shop ? "buyOutfit" : "wear", outfit: item.id })}>
                {shop ? owned ? "已购买" : "购买" : worn ? "卸下" : "穿戴"}</button></div>
          </article>;
        })}
      </>}
    </div>
  </div>;
}
