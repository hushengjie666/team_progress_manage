import { useState } from "react";
import { Coins, Pencil } from "lucide-react";
import { todayKey } from "../seed";
import { foods, outfits, species, type Outfit } from "./catalog";
import { condition, type PetAction, type PetState } from "./model";
import { PetPortrait, type Mood } from "./PetPortrait";
import { PetAdoption } from "./PetAdoption";
import { PetInventory, type Section, type Shelf } from "./PetInventory";
import { RoomArt } from "./PetArtwork";
import { EnergyBar, PetEffects, usePetReaction } from "./PetInteraction";

export type PetHouseProps = {
  state: PetState; time: number; mood: Mood; busy: boolean;
  send: (action: PetAction) => Promise<boolean>;
};

export function PetHouse({ state, time, mood, busy, send, initialTab }: PetHouseProps & { initialTab: Section }) {
  const [tab, setTab] = useState<Section>(initialTab);
  const [shelf, setShelf] = useState<Shelf>("food");
  const [preview, tryOn] = useState<Outfit>();
  const [rename, setRename] = useState<string>();
  const { reaction, play } = usePetReaction();
  const { pet } = state;
  const { fullness, dead, days, left } = condition(state, time);
  if (!pet || dead) return <PetAdoption {...{ state, busy, send, days }}/>;
  const select = (next: Section, section: Shelf = "food") => { tryOn(undefined); setTab(next); setShelf(section); };
  const fit = outfits.find(item => item.id === preview);
  const wearing = fit ? { ...state.wearing, [fit.slot]: fit.id } : state.wearing;
  const perform = async (action: PetAction) => {
    const saved = await send(action);
    if (!saved) return false;
    if (action.kind === "wear") {
      tryOn(undefined);
      play({ kind: "dress", text: "闪亮登场！" });
    } else if (action.kind === "feed" || (action.kind === "buyFood" && action.serve)) {
      const points = foods.find(item => item.id === action.food)!.points;
      play({ kind: "feed", food: action.food, text: "+" + Math.min(points, 100 - Math.ceil(fullness)) + " 饱食度" });
    }
    return true;
  };
  const seconds = Math.ceil(left / 1000);
  const countdown = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
  return <>
    <div className="pet-hud"><div className="pet-wallet"><Coins size={17}/><span aria-label="金币余额"><b>{state.coins}</b></span><small>今日 +<b>{state.earnedDay === todayKey(new Date(time)) ? state.earned : 0}</b></small></div>
      <div className="pet-meter"><small>饱食度 <b>{Math.ceil(fullness)} / 100</b></small><EnergyBar value={fullness}/></div></div>
    {fullness === 0 && <p className="pet-crisis">饥饿危机 · 距饿死 {countdown}</p>}
    <div className={'pet-stage stage-' + mood}>
      <RoomArt mood={mood}/>
      <span className="pet-stage-label">{fit ? "试穿 · " + fit.name : ({ happy: "晴日小憩", focus: "专注陪伴中", hungry: "肚子有点饿", crisis: "等待投喂", eating: "吃得好开心", dead: "" })[mood]}</span>
      <button className={'pet-stage-actor action-' + reaction?.kind} aria-label={'摸摸' + pet.name}
        onClick={() => play({ kind: "pat", text: "最喜欢你啦！" })}>
        <span key={reaction?.id}><PetPortrait animal={pet.species} mood={reaction?.kind === "pat" ? "eating" : mood} wearing={wearing}/></span>
      </button><PetEffects reaction={reaction}/>
    </div>
    <div className="pet-identity">{rename !== undefined ? <form className="pet-rename" onSubmit={async e => {
      e.preventDefault(); if (await send({ kind: "rename", name: rename })) setRename(undefined);
    }}><input autoFocus aria-label="新昵称" maxLength={24} value={rename} onChange={e => setRename(e.target.value)}/>
      <button disabled={busy || !rename.trim()}>保存昵称</button><button type="button" onClick={() => setRename(undefined)}>取消</button></form> :
      <><h3>{pet.name}</h3><button aria-label="修改昵称" onClick={() => setRename(pet.name)}><Pencil size={13}/></button>
        <small>{species[pet.species]} · 陪伴 {days} 天</small></>}
    </div>
    {state.past > 0 && <small>曾陪伴 {state.past} 位伙伴 · 最长 {state.longest} 天</small>}
    <PetInventory {...{ state, busy, tab, shelf, select, preview, tryOn }} send={perform} full={Math.ceil(fullness) >= 100}/>
  </>;
}
