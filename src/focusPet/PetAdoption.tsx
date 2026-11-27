import { useState } from "react";
import { Stars } from "lucide-react";
import { species, type Species } from "./catalog";
import { PetPortrait } from "./PetPortrait";
import type { PetHouseProps } from "./PetHouse";

export function PetAdoption({ state, send, busy, days }: Pick<PetHouseProps, "state" | "send" | "busy"> & { days: number }) {
  const [animal, setAnimal] = useState<Species>("penguin");
  const [name, setName] = useState("");
  const former = state.pet;
  return <div className="pet-ceremony">
    {former && <section className="pet-memorial"><Stars size={23}/><div className="pet-angel"><PetPortrait animal={former.species} mood="dead" wearing={state.wearing}/></div>
      <h3>{former.name} 的纪念星</h3><p>曾一起度过 {days} 天。衣橱将完整传承给新伙伴。</p><small>重新申领后，金币与食物背包清零。</small></section>}
    <form className="pet-adoption" onSubmit={event => { event.preventDefault(); void send({ kind: "adopt", species: animal, name }); }}>
      <div className="pet-spotlight"><div key={animal}><PetPortrait animal={animal} mood="happy"/></div></div>
      <fieldset><legend>挑选初始伙伴</legend><div className="pet-breeds">
        {(Object.keys(species) as Species[]).map(id => <label key={id}>
          <input type="radio" name="pet-breed" checked={animal === id} onChange={() => setAnimal(id)}/>{species[id]}</label>)}
      </div></fieldset>
      <label className="pet-name-input">宠物昵称<input maxLength={24} required value={name} onChange={event => setName(event.target.value)} placeholder="给伙伴起个名字"/></label>
      <button className="pet-primary" disabled={busy || !name.trim()}>{former ? "重新申领新宠物" : "领养伙伴"}</button>
    </form></div>;
}
