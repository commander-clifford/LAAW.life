"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import "./date-handoff-prototype.css";

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
function snapshot() { return new URLSearchParams(window.location.search).get("dateHandoff") === "shared"; }
function serverSnapshot() { return false; }

export function DateHandoffPrototype({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const layerRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const layer = layerRef.current;
    const clone = cloneRef.current;
    const root = layer?.closest<HTMLElement>(".location-page");
    if (!enabled || !layer || !clone || !root) return;
    root.dataset.dateHandoff = "shared";
    const update = () => {
      const source = root.querySelector<HTMLElement>('[data-day-index="0"] .day-card-calendar-date');
      const control = root.querySelector<HTMLElement>(".location-today-control");
      const target = control?.querySelector<HTMLElement>(".location-today-calendar-date");
      const weekday = control?.querySelector<HTMLElement>(".location-today-weekday");
      const viewport = root.querySelector<HTMLElement>(".day-carousel-viewport");
      if (!source || !target || !control || !weekday || !viewport) return;
      const p = Math.min(1, Math.max(0, Number(control.dataset.scrollProgress ?? 0)));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sourceRect = source.getBoundingClientRect();
      const controlRect = control.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const stage = layer.getBoundingClientRect();
      const startX = sourceRect.left + viewport.scrollLeft - stage.left;
      const startY = sourceRect.top - stage.top;
      const endX = controlRect.right - target.offsetWidth - stage.left;
      const endY = targetRect.top - stage.top;
      const sourceStyle = getComputedStyle(source);
      const scale = Number.parseFloat(getComputedStyle(target).fontSize) / Number.parseFloat(sourceStyle.fontSize);
      if (clone.textContent !== source.textContent) clone.textContent = source.textContent;
      clone.style.font = sourceStyle.font;
      clone.style.letterSpacing = sourceStyle.letterSpacing;
      clone.style.transform = `translate3d(${startX + (endX - startX) * p}px, ${startY + (endY - startY) * p}px, 0) scale(${1 + (scale - 1) * p})`;
      clone.style.opacity = !reduced && p > 0 && p < 1 ? "1" : "0";
      source.style.visibility = (reduced ? p >= 0.5 : p > 0) ? "hidden" : "visible";
      target.style.visibility = (reduced ? p >= 0.5 : p === 1) ? "visible" : "hidden";
      weekday.style.opacity = reduced ? (p >= 0.5 ? "1" : "0") : String(p);
      control.style.opacity = reduced ? (p >= 0.5 ? "1" : "0") : p > 0 ? "1" : "0";
      layer.dataset.progress = String(p);
      layer.dataset.reducedMotion = String(reduced);
    };
    let touchDrag: {
      viewport: HTMLElement;
      id: number;
      x: number;
      y: number;
      left: number;
      axis: "pending" | "horizontal" | "vertical";
    } | null = null;
    const finishTouch = () => {
      if (touchDrag) delete touchDrag.viewport.dataset.prototypeTouchDragging;
      touchDrag = null;
    };
    const startTouch = (event: TouchEvent) => {
      finishTouch();
      if (event.touches.length !== 1 || !(event.target instanceof Element)) return;
      const viewport = event.target.closest<HTMLElement>(".day-carousel-viewport");
      const touch = event.touches[0];
      if (!viewport || !touch) return;
      touchDrag = { viewport, id: touch.identifier, x: touch.clientX, y: touch.clientY, left: viewport.scrollLeft, axis: "pending" };
    };
    const moveTouch = (event: TouchEvent) => {
      const drag = touchDrag;
      if (!drag || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const touch = [...event.touches].find(item => item.identifier === drag.id);
      if (!touch) return;
      const dx = touch.clientX - drag.x;
      const dy = touch.clientY - drag.y;
      if (drag.axis === "pending") {
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 6) return;
        drag.axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (drag.axis !== "horizontal") return;
      // Scrub the existing rail without a native horizontal fling competing
      // with its navigation controls. Vertical event/page scrolling stays native.
      drag.viewport.dataset.prototypeTouchDragging = "true";
      drag.viewport.scrollLeft = drag.left - dx;
      if (event.cancelable) event.preventDefault();
    };
    root.addEventListener("touchstart", startTouch, { passive: true });
    root.addEventListener("touchmove", moveTouch, { passive: false });
    root.addEventListener("touchend", finishTouch);
    root.addEventListener("touchcancel", finishTouch);
    const observer = new MutationObserver(update);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-scroll-progress"] });
    const resize = new ResizeObserver(update);
    resize.observe(root);
    window.addEventListener("resize", update);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    preference.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect(); resize.disconnect();
      finishTouch();
      root.removeEventListener("touchstart", startTouch);
      root.removeEventListener("touchmove", moveTouch);
      root.removeEventListener("touchend", finishTouch);
      root.removeEventListener("touchcancel", finishTouch);
      window.removeEventListener("resize", update); preference.removeEventListener("change", update);
      delete root.dataset.dateHandoff;
      for (const element of root.querySelectorAll<HTMLElement>(".day-card-calendar-date, .location-today-calendar-date, .location-today-weekday, .location-today-control")) {
        element.style.removeProperty("visibility"); element.style.removeProperty("opacity");
      }
    };
  }, [enabled]);
  return <>
    {enabled ? <aside className="date-handoff-prototype-note">Local date-motion prototype · visual approval required</aside> : null}
    {children}
    {enabled ? <div className="date-handoff-layer" ref={layerRef} aria-hidden="true"><span className="date-handoff-clone" ref={cloneRef} /></div> : null}
  </>;
}
