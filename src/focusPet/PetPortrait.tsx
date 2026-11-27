import type { ReactNode } from "react";
import { species, type Species, type Slot, type Outfit } from "./catalog";

const clothing: Record<Outfit, ReactNode> = {
  leaf: <g><path fill="#67ac77" d="M46 23Q28 23 27 10Q41 7 46 23Z"/><path fill="#b1ca70" d="M45 22Q43 7 57 5Q60 17 45 22Z"/></g>,
  beret: <g fill="#c16677"><path d="M22 25C17 9 59 0 72 15Q77 24 63 26Z"/><path d="M46 12l4-8 4 2-3 7Z"/></g>,
  crown: <path fill="#f4c65f" d="M27 13l12 7 9-15 10 15 12-9-5 19H31Z"/>,
  vest: <g><path fill="#53988e" d="M30 64l12-3 6 11 7-11 11 3 4 22q-24 10-43 0Z"/><path d="M48 72v16"/><circle cx="52" cy="78" r="1.2"/></g>,
  sailor: <g><path fill="#f6f2d9" d="M30 63h37l4 22q-22 9-44 0Z"/><path fill="#527b9f" d="M29 63h38L49 79Z"/><path fill="none" stroke="#fff" d="M35 65l14 10 12-10"/></g>,
  cape: <g><path fill="#655c91" d="M32 62q16 7 32 0l12 26q-15 4-27-2-14 7-28 3Z"/><path fill="#ffdf8c" d="m37 71 2 4 4 1-4 2-1 4-2-4-4-2 4-1Z"/></g>,
  bow: <g fill="#dd7770"><path d="M48 66l-12-6v13l12-6 13 6V60Z"/><circle cx="48" cy="67" r="3"/></g>,
  bell: <g><path fill="none" stroke="#a88b4f" d="M31 62q16 19 34 0"/><path fill="#f9c85d" d="M43 77q0-9 6-9t6 9l2 2H41Z"/><circle cx="49" cy="81" r="1"/></g>,
  satchel: <g><path fill="none" stroke="#995d3f" strokeWidth="3" d="M33 61l30 24"/><rect x="54" y="76" width="16" height="13" rx="3" fill="#d39762"/><path fill="none" d="m54 78 8 5 8-5"/></g>,
};

const ears: Record<Species, ReactNode> = {
  cat: <g fill="#e7a165"><path d="M20 36l1-24q12 3 20 13m17 0q8-10 18-13l1 24"/><path fill="#e9a099" d="m25 28 1-10 9 8m28 0 9-8 1 11"/></g>,
  shiba: <g fill="#bc784a"><path d="M23 34q-6-28 3-25 12 3 17 17m10 0Q63 6 70 9q7 4 3 25"/><path fill="#e9b197" d="m27 27-2-12 12 13m23 0 9-13 1 13"/></g>,
  penguin: <path fill="#406273" d="M40 23q-3-12 6-15l2 9q6-12 12-8l-5 13Z"/>,
};

export type Mood = "happy" | "focus" | "hungry" | "crisis" | "dead" | "eating";

export function PetPortrait({ animal, mood, wearing = {} }: {
  animal: Species; mood: Mood; wearing?: Partial<Record<Slot, Outfit>>;
}) {
  const bird = animal === "penguin";
  const fur = bird ? "#436473" : animal === "cat" ? "#edaa6e" : "#ce8c55";
  const layer = (slot: Slot) => {
    const id = wearing[slot];
    return id && <g data-outfit={id}>{clothing[id]}</g>;
  };
  return <svg className={'pet-portrait mood-' + mood} viewBox="0 0 96 100" role="img" aria-label={species[animal]}>
    <ellipse cx="49" cy="94" rx="30" ry="4" fill="#526c64" opacity=".15"/>
    <g className="pet-figure" stroke="#564b40" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {!bird && <path fill={fur} d={animal === "cat" ? "M63 84q22 2 18-18-1-8 4-5 10 20-6 28-9 5-16 1Z" : "M61 82q20 3 16-9-4 6-9 2 1-12 13-11 13 6 3 19-9 11-23 7Z"}/>}
      <g fill={bird ? "#eab15c" : fur}><ellipse cx="34" cy="90" rx="11" ry="5"/><ellipse cx="62" cy="90" rx="11" ry="5"/></g>
      <path fill={fur} d="M30 56q-9 8-12 21 1 5 9 0-4 17 21 16 25 0 22-17 9 8 9 0-3-14-13-20Z"/>
      <ellipse fill="#fff2d9" cx="48" cy="76" rx="15" ry="13" stroke="none"/>
      {layer("body")}
      {ears[animal]}
      <path fill={fur} d="M18 43q0-24 30-24t31 24q3 22-30 24-33-1-31-24Z"/>
      {bird ? <path fill="#fff7e5" stroke="none" d="M25 47q-1-18 13-17 8 1 10 10 4-12 14-10 14 4 10 21-4 14-24 13-21 0-23-17Z"/> :
        <path fill="#fff0d6" stroke="none" d="M21 49q10 3 18-2 9-6 18 0 9 6 18 1-2 16-27 16-22-1-27-15Z"/>}
      {animal === "cat" && <path stroke="#bd7747" strokeWidth="3" d="m39 24 2 6m7-7v8m9-7-2 6"/>}
      {animal === "shiba" && <g fill="#ffe6c5" stroke="none"><ellipse cx="34" cy="37" rx="4" ry="2"/><ellipse cx="62" cy="37" rx="4" ry="2"/></g>}
      <g fill="none" stroke="#453e38" strokeWidth="2.6">
        {mood === "dead" ? <path d="m32 41 6 6m0-6-6 6m26-6 6 6m0-6-6 6"/> :
          mood === "eating" ? <path d="M31 46q4-7 8 0m18 0q4-7 8 0"/> :
          mood === "focus" ? <path d="m32 44 7 1m18 0 7-1"/> :
          <g fill="#453e38"><ellipse cx="35" cy="44" rx="1.5" ry={mood === "crisis" ? 1 : 2.2}/><ellipse cx="61" cy="44" rx="1.5" ry={mood === "crisis" ? 1 : 2.2}/></g>}
        {(mood === "hungry" || mood === "crisis") && <path d="m31 39 6-2m22 0 6 2"/>}
      </g>
      <g fill="#e99883" opacity=".62" stroke="none"><ellipse cx="29" cy="51" rx="5" ry="2"/><ellipse cx="67" cy="51" rx="5" ry="2"/></g>
      {bird ? <path fill="#efb457" d="m43 50 5-3 6 3-6 5Z"/> :
        <g><path fill="#5a463b" d="m44 48 8 0-4 4Z"/><path fill="none" d={mood === "crisis" ? "M44 56q4-4 8 0" : "M48 52q-1 6-6 2m6-2q1 6 6 2"}/></g>}
      {layer("head")}{layer("charm")}
    </g>
  </svg>;
}
