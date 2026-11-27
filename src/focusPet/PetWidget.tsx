import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampMiniTimerPosition } from "../components/focus/miniTimerPosition";
import { placeHouse, placePet, type Obstacle } from "./placement";
import { condition, type Position } from "./model";
import { PetHouse, type PetHouseProps } from "./PetHouse";
import { PetPortrait } from "./PetPortrait";
import { foods } from "./catalog";
import { PetActionRing } from "./PetActionRing";
import { lines, PetEffects, usePetReaction } from "./PetInteraction";
import { House, X } from "lucide-react";
import type { Section } from "./PetInventory";
import "./pet.css";

export function PetWidget(props: PetHouseProps & { warning: string; coinFlash: boolean }) {
  const { state, mood, send, warning, coinFlash } = props;
  const [panel, setPanel] = useState<"ring" | "house">();
  const [initialTab, setInitialTab] = useState<Section>("bag");
  const { reaction, play, clear } = usePetReaction();
  const { fullness, dead } = condition(state, props.time);
  const alive = Boolean(state.pet && !dead);
  const ring = panel === "ring" && alive;
  const open = panel === "house" || (panel === "ring" && !alive);
  const controls = useRef<Obstacle[]>([]);
  const [drag, setDrag] = useState<Position>();
  const [size, setSize] = useState({ width: 76, height: 96, vw: innerWidth, vh: innerHeight });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const press = useRef<{ id: number; x: number; y: number; origin: Position; moved: boolean }>();
  const suppressClick = useRef(false);
  useLayoutEffect(() => {
    const measure = () => {
      controls.current = Array.from(document.querySelectorAll(".topbar, .timer-controls, .mode-switcher, .focus-layout button"), area => area.getBoundingClientRect())
        .filter(rect => rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight);
      const orbit = document.querySelector(".focus-orbit")?.getBoundingClientRect();
      setObstacles(orbit ? [...controls.current, orbit] : controls.current);
      if (root.current) setSize({ width: root.current.offsetWidth, height: root.current.offsetHeight,
        vw: document.documentElement.clientWidth, vh: innerHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    const layout = document.querySelector(".focus-layout");
    if (layout) observer.observe(layout);
    const changes = new MutationObserver(measure);
    if (layout) changes.observe(layout, { childList: true, subtree: true });
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); changes.disconnect(); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [state.compact]);
  useEffect(() => {
    if (!panel) return;
    const dismiss = () => { setPanel(undefined); button.current?.focus({ preventScroll: true }); };
    if (open) close.current?.focus({ preventScroll: true });
    else root.current?.querySelector<HTMLButtonElement>(".ring-pat")?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
    };
    const outside = (event: PointerEvent) => {
      if (ring && !root.current?.contains(event.target as Node)) setPanel(undefined);
    };
    window.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [panel, open, ring]);
  useEffect(() => {
    if (alive && !state.compact && mood !== "eating") play({ kind: "say", text: lines[mood] });
  }, [mood, alive, state.compact]);
  const { vw, vh, width, height } = size;
  const navGap = vw < 760 ? 82 : 18;
  const available = vh - navGap + 10;
  const clamp = (p: Position) => clampMiniTimerPosition(p, width, height, vw, available);
  const pos = drag ? clamp(drag) : placePet(state.position ?? { x: vw - width - 18, y: vh - height - navGap },
    width, height, vw, available, obstacles);
  const ringWidth = 204, ringHeight = height + 84;
  const ringPos = ring ? placePet({ x: pos.x - (ringWidth - width) / 2, y: pos.y - 57 }, ringWidth, ringHeight, vw, available, obstacles) : pos;
  const display = ring ? { x: ringPos.x + (ringWidth - width) / 2, y: ringPos.y + 57 } : pos;
  const pet = state.pet;
  const food = foods.find(item => state.bag[item.id]);
  const house = (tab: Section = "bag") => { clear(); setInitialTab(tab); setPanel("house"); };
  const housePosition = () => {
    const besideTimer = placeHouse(pos, vw, available, obstacles);
    // On narrow screens retain a usable game window in the gap above the timer buttons.
    return besideTimer.maxHeight >= 390 ? besideTimer : placeHouse(pos, vw, available, controls.current);
  };
  const feed = async () => {
    if (!food) { house("shop"); return; }
    if (await send({ kind: "feed", food: food.id })) {
      play({ kind: "feed", food: food.id, text: "+" + Math.min(food.points, 100 - Math.ceil(fullness)) + " 饱食度" });
    }
  };
  return <>
    <div ref={root} className={'pet-widget' + (state.compact ? " compact" : "")} style={{ left: display.x, top: display.y }}>
      {ring && <PetActionRing {...{ fullness, coins: state.coins, busy: props.busy, hasFood: Boolean(food) }}
        pat={() => play({ kind: "pat", text: "呼噜，再摸一下！" })} feed={() => void feed()} open={() => house()}/>}
      <button ref={button} className={'pet-launch action-' + reaction?.kind} aria-label={alive ? "宠物快捷互动" : pet ? "打开宠物纪念" : "申领宠物"} aria-expanded={Boolean(panel)}
        onClick={() => {
          if (!suppressClick.current) {
            if (panel) setPanel(undefined);
            else if (alive) { clear(); setPanel("ring"); }
            else house();
          }
          suppressClick.current = false;
        }}
        onPointerDown={e => {
          if (e.button !== 0 || !e.isPrimary) return;
          suppressClick.current = false;
          press.current = { id: e.pointerId, origin: display, x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          const dx = e.clientX - p.x, dy = e.clientY - p.y;
          if (!p.moved && Math.hypot(dx, dy) < 5) return;
          p.moved = true;
          setPanel(undefined);
          setDrag(clamp({ x: p.origin.x + dx, y: p.origin.y + dy }));
        }}
        onPointerCancel={() => { press.current = undefined; setDrag(undefined); }}
        onPointerUp={e => {
          const p = press.current;
          press.current = undefined;
          if (!p?.moved) return;
          suppressClick.current = true;
          const position = clamp({ x: p.origin.x + e.clientX - p.x, y: p.origin.y + e.clientY - p.y });
          void send({ kind: "move", position }).finally(() => setDrag(undefined));
        }}>
        <i className="pet-grass" aria-hidden="true"/>
        <i key={reaction?.id} className="pet-body"><PetPortrait animal={pet?.species ?? "penguin"} mood={reaction?.kind === "pat" ? "eating" : mood} wearing={state.wearing}/></i>
        {!state.compact && <span>{pet?.name ?? "申领宠物"}</span>}
      </button>
      {!open && alive && <div className={'pet-widget-fx' + (display.y < 48 ? " below" : "")}
        style={{ left: Math.max(66, Math.min(display.x + width / 2, vw - 66)) - display.x }}><PetEffects reaction={reaction}/></div>}
      {pet && <button className="pet-fold" aria-label={state.compact ? "展开宠物挂件" : "收起宠物挂件"}
        onClick={() => { setPanel(undefined); void send({ kind: "compact", value: !state.compact }); }}>{state.compact ? "＋" : "−"}</button>}
      {coinFlash && <output className="pet-coin">+1</output>}
    </div>
    {ring && warning && <p className="pet-warning" role="status">{warning}</p>}
    {open && <section role="dialog" aria-label="宠物小屋" className="pet-house" style={housePosition()}>
      <header><h2><House size={18}/>宠物小屋</h2><button ref={close} aria-label="关闭宠物小屋"
        onClick={() => { setPanel(undefined); button.current?.focus({ preventScroll: true }); }}><X size={16}/></button></header>
      {warning && <p role="status">{warning}</p>}
      <PetHouse key={pet?.born} {...props} initialTab={initialTab}/></section>}
  </>;
}
