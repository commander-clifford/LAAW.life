"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import "./event-row-prototype.css";

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
function getLayout() {
  return new URLSearchParams(window.location.search).get("eventLayout") ?? "";
}
function getServerLayout() { return ""; }

export function EventRowPrototype({ children }: { children: ReactNode }) {
  const layout = useSyncExternalStore(subscribe, getLayout, getServerLayout);
  const enabled = layout === "current" || layout === "title-first";
  function select(value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("eventLayout", value);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return (
    <div className="event-row-prototype" data-event-layout={layout}>
      {enabled ? (
        <aside className="event-row-prototype-controls" aria-label="Event row design preview">
          <p>Local design prototype · visual approval required</p>
          <div>
            <button type="button" aria-pressed={layout === "current"} onClick={() => select("current")}>Current: time first</button>
            <button type="button" aria-pressed={layout === "title-first"} onClick={() => select("title-first")}>Proposed: title first</button>
          </div>
        </aside>
      ) : null}
      {children}
    </div>
  );
}
