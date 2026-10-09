"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { motionStorageKey, subscribeToMotionPreference, validMotionPreference } from "@/src/application/motion-preference";

function getPreference() { return validMotionPreference(document.documentElement.dataset.motion); }
function getServerPreference() { return "system" as const; }

export function MotionControl() {
  const preference = useSyncExternalStore(subscribeToMotionPreference, getPreference, getServerPreference);
  useLayoutEffect(() => {
    try {
      document.documentElement.dataset.motion = validMotionPreference(window.localStorage.getItem(motionStorageKey));
      window.dispatchEvent(new Event("laaw-motion-change"));
    } catch {
      // Device settings remain available when preference storage is blocked.
    }
  }, []);
  return (
    <label className="theme-control motion-control">
      <span>Motion</span>
      <select value={preference} onChange={event => {
        const next = validMotionPreference(event.target.value);
        document.documentElement.dataset.motion = next;
        try { window.localStorage.setItem(motionStorageKey, next); } catch { /* Works for this visit. */ }
        window.dispatchEvent(new Event("laaw-motion-change"));
      }}>
        <option value="system">Use device setting</option>
        <option value="reduce">Reduce motion</option>
      </select>
    </label>
  );
}
