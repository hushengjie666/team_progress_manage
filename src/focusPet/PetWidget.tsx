import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { clampMiniTimerPosition } from "../components/focus/miniTimerPosition";
import { placeDock, placeHouse, placePet, type Obstacle } from "./placement";
import { condition, type Position } from "./model";
import { PetHouse, type PetHouseProps } from "./PetHouse";
import { PetPortrait } from "./PetPortrait";
import { DragGhost, dropHint, useItemDrag, type Item } from "./useItemDrag";
import { foods, outfits } from "./catalog";
import { PetActionRing } from "./PetActionRing";
import { lines, PetEffects, usePetReaction } from "./PetInteraction";
import { House, X } from "lucide-react";
import type { Section, Shelf } from "./PetInventory";
import "./pet.css";

function keepButtonActivation(event: ReactKeyboardEvent) {
  if (event.key === " ") event.stopPropagation();
}

export function PetWidget(props: PetHouseProps & { warning: string; coinFlash: boolean }) {
  const { state, mood, send, warning, coinFlash } = props;
  const [panel, setPanel] = useState<"ring" | "house">();
  const [initialTab, setInitialTab] = useState<Section>("bag");
  const [initialShelf, setInitialShelf] = useState<Shelf>("food");
  const [initialPosition, setInitialPosition] = useState<Position>();
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
      if (!root.current) return;
      const width = root.current.offsetWidth, height = root.current.offsetHeight;
      const vw = document.documentElement.clientWidth, vh = innerHeight;
      setSize({ width, height, vw, vh });
      const gap = vw < 760 ? 82 : 18;
      // Mobile task actions occupy the right edge as the list scrolls.
      const initialX = vw < 760 ? 18 : vw - width - 18;
      setInitialPosition(previous => previous ?? placePet({ x: initialX, y: vh - height - gap },
        width, height, vw, vh - gap + 10, orbit ? [...controls.current, orbit] : controls.current));
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
  const pos = clamp(drag ?? state.position ?? initialPosition ?? { x: vw - width - 18, y: vh - height - navGap });
  const pet = state.pet;
  const full = Math.ceil(fullness) >= 100;
  const useItem = async (item: Item) => {
    if (props.busy || !alive || (item.kind === "feed" && full) || !(await send(item))) return;
    if (item.kind === "feed") {
      const food = foods.find(option => option.id === item.food)!;
      play({ kind: "feed", food: food.id, text: "+" + Math.min(food.points, 100 - Math.ceil(fullness)) + " 饱食度" });
    } else play({ kind: "dress", text: "闪亮登场！" });
  };
  const { bind, drag: itemDrag } = useItemDrag(button, ring && !props.busy, useItem);
  const hover = itemDrag?.hit ? itemDrag.item : undefined;
  const fit = hover?.kind === "wear" && outfits.find(option => option.id === hover.outfit);
  const wearing = fit ? { ...state.wearing, [fit.slot]: fit.id } : state.wearing;
  const house = (tab: Section = "bag", shelf: Shelf = "food") => {
    clear(); setInitialTab(tab); setInitialShelf(shelf); setPanel("house");
  };
  const housePosition = () => {
    const body = { left: pos.x, right: pos.x + width, top: pos.y, bottom: pos.y + height };
    const besideTimer = placeHouse(pos, vw, available, [...obstacles, body]);
    // On narrow screens retain a usable game window in the gap above the timer buttons.
    if (besideTimer.maxHeight >= 390) return besideTimer;
    const besidePet = placeHouse(pos, vw, available, [...controls.current, body]);
    return besidePet.maxHeight >= 330 ? besidePet : placeHouse(pos, vw, available, controls.current);
  };
  return <>
    <div ref={root} onKeyDown={keepButtonActivation} className={'pet-widget' + (state.compact ? " compact" : "")} style={{ left: pos.x, top: pos.y }}>
      {ring && <PetActionRing {...{ fullness, state, busy: props.busy, bind, useItem }}
        style={placeDock(pos, width, height, vw, available, controls.current)}
        pat={() => play({ kind: "pat", text: "呼噜，再摸一下！" })} shop={shelf => house("shop", shelf)} open={() => house()}/>}
      {pet && <DragGhost drag={itemDrag}/>}
      <button ref={button} data-drop-target={Boolean(hover)} className={'pet-launch action-' + reaction?.kind} aria-label={alive ? "宠物快捷互动" : pet ? "打开宠物纪念" : "申领宠物"} aria-expanded={Boolean(panel)}
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
          press.current = { id: e.pointerId, origin: pos, x: e.clientX, y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          const dx = e.clientX - p.x, dy = e.clientY - p.y;
          if (!p.moved && Math.hypot(dx, dy) <= 9) return;
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
        <i key={reaction?.id} className="pet-body"><PetPortrait animal={pet?.species ?? "penguin"} mood={(reaction?.kind === "pat" || (hover?.kind === "feed" && !full)) ? "eating" : mood} wearing={wearing}/></i>
        {!state.compact && <span>{pet?.name ?? "申领宠物"}</span>}
      </button>
      {!open && alive && <div className={'pet-widget-fx' + (pos.y < 48 ? " below" : "")}
        style={{ left: Math.max(86, Math.min(pos.x + width / 2, vw - 86)) - pos.x }}>{hover ? <span role="status" className="pet-drop-hint">{dropHint(hover, full)}</span> : <PetEffects reaction={reaction}/>}</div>}
      {pet && <button className="pet-fold" aria-label={state.compact ? "展开宠物挂件" : "收起宠物挂件"}
        onClick={() => { setPanel(undefined); void send({ kind: "compact", value: !state.compact }); }}>{state.compact ? "＋" : "−"}</button>}
      {coinFlash && <output className="pet-coin">+1</output>}
    </div>
    {ring && warning && <p className="pet-warning" role="status">{warning}</p>}
    {open && <section onKeyDown={keepButtonActivation} role="dialog" aria-label="宠物小屋" className="pet-house" style={housePosition()}>
      <header><h2><House size={18}/>宠物小屋</h2><button ref={close} aria-label="关闭宠物小屋"
        onClick={() => { setPanel(undefined); button.current?.focus({ preventScroll: true }); }}><X size={16}/></button></header>
      {warning && <p role="status">{warning}</p>}
      <PetHouse key={pet?.born} {...props} initialTab={initialTab} initialShelf={initialShelf}/></section>}
  </>;
}
