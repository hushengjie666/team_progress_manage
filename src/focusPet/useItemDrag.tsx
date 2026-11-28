import { useEffect, useRef, useState, type PointerEvent, type MouseEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { outfits, type Food, type Outfit } from "./catalog";
import { FoodArt } from "./PetArtwork";
import { OutfitArt } from "./PetPortrait";

export type Item = { kind: "feed"; food: Food } | { kind: "wear"; outfit: Outfit };
type Drag = { item: Item; x: number; y: number; hit: boolean };

export function useItemDrag(target: RefObject<HTMLElement>, enabled: boolean, useItem: (item: Item) => void) {
  const [drag, setDrag] = useState<Drag>();
  const press = useRef<{ id: number; x: number; y: number; moved: boolean; item: Item }>();
  const suppressClick = useRef(false);
  const cancel = () => {
    if (press.current?.moved) suppressClick.current = true;
    press.current = undefined;
    setDrag(undefined);
  };
  useEffect(() => {
    if (!enabled) { cancel(); return; }
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && press.current) {
        event.stopImmediatePropagation();
        cancel();
      }
    };
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
    };
  }, [enabled]);
  const hit = (x: number, y: number) => {
    const r = target.current?.getBoundingClientRect();
    return Boolean(r && x >= r.left && x < r.right && y >= r.top && y < r.bottom &&
      target.current?.contains(document.elementFromPoint(x, y)));
  };
  const bind = (item: Item) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!enabled || !event.isPrimary || event.button !== 0) return;
      suppressClick.current = false;
      const source = (event.target as Element).closest("button") ?? event.currentTarget;
      source.setPointerCapture(event.pointerId);
      press.current = { id: event.pointerId, item, x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const p = press.current;
      if (!p || p.id !== event.pointerId || !enabled) return;
      const { clientX: x, clientY: y } = event;
      if (!p.moved && Math.hypot(p.x - x, p.y - y) < 8) return;
      p.moved = true;
      setDrag({ item: p.item, x, y, hit: hit(x, y) });
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const p = press.current;
      if (p?.id !== event.pointerId) return;
      cancel();
      if (enabled && p.moved && hit(event.clientX, event.clientY)) useItem(p.item);
    },
    onLostPointerCapture(event: PointerEvent<HTMLElement>) {
      if (press.current?.id === event.pointerId) cancel();
    },
    onPointerCancel: cancel,
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (event.detail && suppressClick.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }
    },
  });
  return { drag, bind };
}

export type ItemGestures = ReturnType<typeof useItemDrag>["bind"];

export function DragGhost({ drag }: { drag?: Drag }) {
  if (!drag) return null;
  const item = drag.item;
  const fit = item.kind === "wear" && outfits.find(option => option.id === item.outfit);
  return createPortal(<div aria-hidden="true" className="pet-drag-layer">
    <div className="pet-drag-ghost" style={{ left: drag.x, top: drag.y }}>
      {item.kind === "feed" ? <FoodArt food={item.food}/> : fit && <OutfitArt outfit={fit}/>}
    </div>
  </div>, document.body);
}

export function dropHint(item: Item | undefined, full: boolean) {
  if (item?.kind === "feed") return full ? "饱食度已满，待会儿再吃" : "啊呜，快喂我！";
  if (item) return "松手切换穿搭";
}
