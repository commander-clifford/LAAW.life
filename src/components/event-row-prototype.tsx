"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import "./event-row-prototype.css";

const reviewPreview = process.env.NEXT_PUBLIC_REVIEW_PREVIEW === "true";
function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
function getPreviewLayout() {
  if (!reviewPreview) return "";
  return new URLSearchParams(window.location.search).get("eventLayout") ?? "";
}
function getServerPreviewLayout() { return ""; }

export function EventRowPrototype({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(subscribe, getPreviewLayout, getServerPreviewLayout);
  const layout = choice === "current" ? "current" : "title-first";
  const enabled = reviewPreview && (choice === "current" || choice === "title-first");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const leave = (event: Event) => {
      if (event.target instanceof Node && !panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("focusin", leave);
    document.addEventListener("pointerdown", leave);
    return () => {
      document.removeEventListener("focusin", leave);
      document.removeEventListener("pointerdown", leave);
    };
  }, [open]);
  function select(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("eventLayout", value);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <div className="event-row-prototype" data-event-layout={layout}>
      {enabled ? createPortal(
        <aside ref={panelRef} className="event-row-prototype-controls" data-open={open} aria-label="Preview controls" onKeyDown={event => {
          if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus();
          }
        }}>
          <button ref={triggerRef} className="preview-panel-toggle" type="button" aria-label={open ? "Hide preview controls" : "Preview controls"} aria-expanded={open} aria-controls="preview-row-controls" onClick={() => setOpen(value => !value)}>
            <SlidersHorizontal aria-hidden="true" /><span>{open ? "Hide preview controls" : "Preview controls"}</span>
          </button>
          <div id="preview-row-controls" hidden={!open}>
            <p>Event rows</p>
            <div className="preview-panel-options">
              <button type="button" aria-pressed={layout === "current"} onClick={() => select("current")}>Current: time first</button>
              <button type="button" aria-pressed={layout === "title-first"} onClick={() => select("title-first")}>Proposed: title first</button>
            </div>
            <p>Current date animation · alternative deferred</p>
          </div>
        </aside>, document.body
      ) : null}
      {children}
    </div>
  );
}
