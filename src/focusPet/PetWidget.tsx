import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampMiniTimerPosition } from "../components/focus/miniTimerPosition";
import { placePet, type Obstacle } from "./placement";
import type { Position } from "./model";
import { PetHouse, type PetHouseProps } from "./PetHouse";
import { PetPortrait } from "./PetPortrait";
import "./pet.css";

export function PetWidget(props: PetHouseProps & { warning: string; coinFlash: boolean }) {
  const { state, mood, send, warning, coinFlash } = props;
  const [open, setOpen] = useState(false);
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
      const areas = document.querySelectorAll(".focus-orbit, .timer-controls, .mode-switcher, .focus-layout button");
      setObstacles(Array.from(areas, area => area.getBoundingClientRect())
        .filter(rect => rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight));
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
  }, []);
  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  const { vw, vh, width, height } = size;
  const navGap = vw < 760 ? 82 : 18;
  const clamp = (p: Position) => clampMiniTimerPosition(p, width, height, vw, vh - navGap + 10);
  const pos = drag ? clamp(drag) : placePet(state.position ?? { x: vw - width - 18, y: vh - height - navGap },
    width, height, vw, vh - navGap + 10, obstacles);
  const pet = state.pet;
  const show = () => { setOpen(value => !value); };
  return <>
    <div ref={root} className={'pet-widget' + (state.compact ? " compact" : "")} style={{ left: pos.x, top: pos.y }}>
      <button ref={button} className="pet-launch" aria-label={pet ? "打开宠物小屋" : "申领宠物"} aria-expanded={open}
        onClick={() => { if (!suppressClick.current) show(); suppressClick.current = false; }}
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
          if (!p.moved && Math.hypot(dx, dy) < 5) return;
          p.moved = true;
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
        <PetPortrait animal={pet?.species ?? "penguin"} mood={mood} wearing={state.wearing}/>
        {!state.compact && <span>{pet?.name ?? "申领宠物"}</span>}
      </button>
      {pet && <button className="pet-fold" aria-label={state.compact ? "展开宠物挂件" : "收起宠物挂件"}
        onClick={() => void send({ kind: "compact", value: !state.compact })}>{state.compact ? "＋" : "−"}</button>}
      {coinFlash && <output className="pet-coin">+1</output>}
    </div>
    {open && <section role="dialog" aria-label="宠物小屋" className="pet-house" style={{
      left: Math.max(8, Math.min(pos.x + width - 348, vw - Math.min(348, vw - 16) - 8)),
      ...(pos.y > vh / 2 ? { bottom: vh - pos.y + 6, maxHeight: pos.y - 14 } :
        { top: pos.y + height + 6, maxHeight: vh - pos.y - height - navGap - 12 }),
    }}><header><h2>宠物小屋</h2><button ref={close} aria-label="关闭宠物小屋" onClick={() => { setOpen(false); button.current?.focus(); }}>×</button></header>
      {warning && <p role="status">{warning}</p>}
      <PetHouse {...props}/></section>}
  </>;
}
