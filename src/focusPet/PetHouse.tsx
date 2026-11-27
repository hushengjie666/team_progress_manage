import { useState } from "react";
import { todayKey } from "../seed";
import { foods, outfits, slots, species, type Species } from "./catalog";
import { condition, type PetAction, type PetState } from "./model";
import { PetPortrait, type Mood } from "./PetPortrait";

export type PetHouseProps = {
  state: PetState; time: number; mood: Mood; busy: boolean;
  send: (action: PetAction) => Promise<boolean>;
};

function Adoption({ send, busy, again }: Pick<PetHouseProps, "send" | "busy"> & { again: boolean }) {
  const [animal, setAnimal] = useState<Species>("penguin");
  const [name, setName] = useState("");
  return <form className="pet-adoption" onSubmit={event => { event.preventDefault(); void send({ kind: "adopt", species: animal, name }); }}>
    <fieldset><legend>选择你的专注伙伴</legend><div className="pet-breeds">
      {(Object.keys(species) as Species[]).map(id => <label key={id}>
        <input type="radio" name="pet-breed" checked={animal === id} onChange={() => setAnimal(id)}/>
        <PetPortrait animal={id} mood="happy"/>{species[id]}</label>)}
    </div></fieldset>
    <label>宠物昵称<input maxLength={24} required value={name} onChange={event => setName(event.target.value)} placeholder="给伙伴起个名字"/></label>
    <button className="pet-primary" disabled={busy || !name.trim()}>{again ? "重新申领新宠物" : "领养伙伴"}</button>
  </form>;
}

const tabs = ["喂食背包", "食物商店", "衣服商店", "衣橱换装", "改名"] as const;
export function PetHouse({ state, time, mood, busy, send }: PetHouseProps) {
  const [tab, setTab] = useState<typeof tabs[number]>("喂食背包");
  const [name, setName] = useState("");
  const { pet } = state;
  const { fullness, dead, days, left } = condition(state, time);
  if (!pet) return <Adoption send={send} busy={busy} again={false}/>;
  if (dead) return <><p className="pet-memorial">{pet.name} 已饿死。谢谢你们一起度过的 {days} 天。</p>
    <p>重新申领后保留衣橱，金币与食物背包清零。</p><Adoption send={send} busy={busy} again/></>;
  const full = fullness >= 100;
  const seconds = Math.ceil(left / 1000);
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
  return <>
    <div className="pet-profile"><PetPortrait animal={pet.species} mood={mood} wearing={state.wearing}/>
      <div><h3>{pet.name}</h3><p>{species[pet.species]} · 已陪伴 {days} 天</p>
        <strong>{({ happy: "健康饱腹", eating: "吃得好开心", focus: "专注陪伴中", hungry: "有点饿了", crisis: "饥饿危机", dead: "陪伴纪念" })[mood]}</strong></div></div>
    <label className="pet-meter">饱食度 <b>{Math.ceil(fullness)} / 100</b><progress max={100} value={fullness}/></label>
    {fullness === 0 && <p className="pet-crisis">饥饿危机 · 距饿死 {countdown}</p>}
    <div className="pet-wallet"><span>金币余额 <b>{state.coins}</b></span><span>今日产金 <b>{state.earnedDay === todayKey(new Date(time)) ? state.earned : 0}</b></span></div>
    {state.past > 0 && <p>曾陪伴 {state.past} 位伙伴 · 最长 {state.longest} 天</p>}
    <div className="pet-tabs">{tabs.map(item => <button key={item} aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === "改名" ? <form className="pet-rename" onSubmit={e => { e.preventDefault(); void send({ kind: "rename", name }); }}>
      <label>新昵称<input value={name} maxLength={24} onChange={e => setName(e.target.value)}/></label>
      <button disabled={busy || !name.trim()}>保存昵称</button></form> :
      tab === "喂食背包" || tab === "食物商店" ? <>
        {tab === "喂食背包" && !foods.some(f => state.bag[f.id]) && <p>背包里还没有食物。专注每满一分钟可获得一枚金币。</p>}
        {foods.filter(f => tab === "食物商店" || state.bag[f.id]).map(f => <div className="pet-item" key={f.id}>
          <div><b>{f.name}</b><small>+{f.points} 饱食度 · {tab === "食物商店" ? f.price + " 金币" : "剩余 " + state.bag[f.id] + " 份"}</small></div>
          {tab === "食物商店" ? <div><button disabled={busy || state.coins < f.price} onClick={() => void send({ kind: "buyFood", food: f.id, serve: false })}>存入背包</button>
            <button disabled={busy || state.coins < f.price || full} onClick={() => void send({ kind: "buyFood", food: f.id, serve: true })}>买下喂食</button>
            {state.coins < f.price && <small>还差 {f.price - state.coins} 金币</small>}</div> :
            <button disabled={busy || full} onClick={() => void send({ kind: "feed", food: f.id })}>喂食</button>}</div>)}
        {full && <p>饱食度已满，稍后再喂食。</p>}
      </> : <>
        {tab === "衣橱换装" && !state.wardrobe.length && <p>衣橱还是空的，去衣服商店看看吧。</p>}
        {outfits.filter(item => tab === "衣服商店" || state.wardrobe.includes(item.id)).map(item => {
          const owned = state.wardrobe.includes(item.id);
          const shop = tab === "衣服商店";
          return <div className="pet-item" key={item.id}><PetPortrait animal={pet.species} mood="happy" wearing={{ [item.slot]: item.id }}/>
            <div><b>{item.name}</b><small>{slots[item.slot]} · {item.price} 金币</small></div><div>
              <button disabled={busy || (shop && (owned || state.coins < item.price))}
                onClick={() => void send({ kind: shop ? "buyOutfit" : "wear", outfit: item.id })}>
                {shop ? owned ? "已购买" : "购买" : state.wearing[item.slot] === item.id ? "卸下" : "穿戴"}</button>
              {shop && !owned && state.coins < item.price && <small>还差 {item.price - state.coins} 金币</small>}</div></div>;
        })}</>}
  </>;
}
