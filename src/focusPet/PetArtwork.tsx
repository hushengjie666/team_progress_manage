import { useId } from "react";
import type { Food } from "./catalog";
import type { Mood } from "./PetPortrait";

export function FoodArt({ food }: { food: Food }) {
  return <svg aria-hidden="true" viewBox="0 0 72 55" className="pet-food-art">
    <ellipse cx="36" cy="47" rx="25" ry="4" fill="#bf9167" opacity=".22"/>
    <g stroke="#805838" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      {food === "berry" && <><path fill="#c18c51" d="M10 36q-4-13 13-17 20-4 24 9 5 11-12 16-20 5-25-8Z"/>
        <path fill="#f2c780" d="M25 28Q19 15 33 9q17-7 25 5 9 13-4 22-19 10-29-8Z"/>
        <g fill="#a14d58"><circle cx="34" cy="19" r="3"/><circle cx="48" cy="14" r="2.5"/><circle cx="48" cy="29" r="3.5"/><circle cx="21" cy="32" r="2.5"/></g>
        <path stroke="#fff0b8" d="m31 26 3 2m18-7 2-1m-32 18 3 1"/></>}
      {food === "bun" && <><path fill="#fff2c6" d="m10 38 26 9 27-9-25-9Z"/>
        <path fill="#f2b76b" d="M13 35q0-10 12-20 5-6 10-5 8-5 13 4 13 8 12 21-2 9-24 9-19 0-23-9Z"/>
        <path fill="none" stroke="#c68a4c" d="M33 14q-12 10-12 19m16-19q-4 7-4 13m8-12q12 9 12 17"/>
        <path fill="#7f9a54" d="M35 12q-9-1-8-8 8 0 10 7 2-8 9-9 3 7-11 10Z"/></>}
      {food === "soup" && <><path fill="#84abb0" d="M8 25h56q-3 21-28 21T8 25Z"/>
        <ellipse fill="#f6ce7d" cx="36" cy="25" rx="28" ry="8"/><path fill="#dd8c55" d="m20 23 8-4 5 5-8 3Z"/>
        <path fill="#7e9b50" d="m36 25 7-7 4 7-6 3Z"/><path fill="#c9966d" d="m48 23 9-15 4 2-8 15Z"/>
        <path fill="none" stroke="#b88d68" d="M23 15q-5-4 1-8m11 7q6-5 1-11"/></>}
      {food === "feast" && <><ellipse fill="#d3ded1" cx="36" cy="37" rx="31" ry="10"/><ellipse fill="#fff4d0" cx="36" cy="35" rx="26" ry="7"/>
        <path fill="#8da158" d="M12 34q-3-9 5-8-2-9 7-7l8 12-8 7Z"/><path fill="#c78246" d="M22 31q1-14 16-17 15-2 17 10 3 12-13 15-14 3-20-8Z"/>
        <path fill="#fff2d4" d="m47 20 7-9q-2-5 2-6 5-1 5 3 5-1 5 3t-7 4l-6 9Z"/>
        <path fill="none" stroke="#f8be78" d="m30 23 5 5m2-10 6 6"/><g fill="#d96e4e"><circle cx="18" cy="36" r="4"/><circle cx="53" cy="34" r="4"/></g></>}
    </g>
  </svg>;
}

export function RoomArt({ mood }: { mood: Mood }) {
  const id = useId().replace(/:/g, "");
  const sky = mood === "crisis" ? "#eab0a1" : mood === "hungry" ? "#b5c5be" : mood === "focus" ? "#f6c689" : "#b6ddda";
  return <svg className="pet-room-art" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><path d="m6 8 2-3 2 3-2 3Z" fill="#b5aa7d" opacity=".25"/></pattern></defs>
    <path fill="#eee2b8" d="M0 0h400v150H0z"/><path fill={'url(#' + id + ')'} d="M0 0h400v110H0z"/>
    <path fill="#d1aa7c" d="M0 101h400v49H0z"/><g stroke="#b48762" fill="none" opacity=".5"><path d="M0 113h400M0 132h400M85 101l-52 49m121-49-18 49m106-49 20 49m68-49 55 49"/></g>
    <g stroke="#946d4b" strokeWidth="3"><rect x="36" y="12" width="88" height="72" rx="20" fill="#e4b580"/>
      <rect x="42" y="18" width="76" height="58" rx="15" fill={sky}/></g>
    <circle cx="64" cy="35" r="9" fill="#fff1ac"/><path fill="#93b58e" d="M43 61q24-22 42-5 18-11 32-6v19q0 6-9 6H52q-8 0-9-7Z"/>
    <path stroke="#b78658" strokeWidth="4" d="M80 17v59M42 48h76"/><rect x="30" y="79" width="100" height="7" rx="3" fill="#ad8459"/>
    <path fill="#fff7cd" opacity=".27" d="m44 84 70 0 106 53-97 0Z"/>
    <ellipse cx="208" cy="129" rx="76" ry="14" fill="#af8a63" opacity=".35"/>
    <ellipse cx="207" cy="126" rx="77" ry="14" fill="#90a98b"/><ellipse cx="207" cy="126" rx="66" ry="10" fill="none" stroke="#d9dab2" strokeDasharray="3 3"/>
    <path stroke="#8d6c4b" strokeWidth="3" fill="none" d="M337 92q-2-21 5-40m-5 24-13-11m14 1 13-11"/>
    <g fill="#77976b"><ellipse cx="325" cy="61" rx="7" ry="12" transform="rotate(-34 325 61)"/><ellipse cx="350" cy="53" rx="8" ry="13" transform="rotate(33 350 53)"/><ellipse cx="340" cy="46" rx="6" ry="11"/></g>
    <path fill="#bf8465" stroke="#976a51" strokeWidth="2" d="M319 83h34l-5 25q-12 5-24-1Z"/><rect x="317" y="80" width="38" height="8" rx="3" fill="#d89c77"/>
    <path stroke="#977552" strokeWidth="2" d="M280 0v16"/><path fill={mood === "focus" ? "#ffc85b" : "#b59b69"} d="M261 32q2-16 19-16t19 16Z"/>
    <ellipse cx="280" cy="32" rx="19" ry="3" fill="#ffe2a3"/>
    {mood === "focus" && <path fill="#ffe49c" opacity=".4" d="m263 34-51 91h126l-42-91Z"/>}
  </svg>;
}
