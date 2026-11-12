import { getNewerCalendarAgenda } from "./calendar-agenda";
import type { CalendarAgenda } from "./ports";

// Survives client-side location navigation; storage also survives reloads.
const lastGood = new Map<string, CalendarAgenda>();
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
const key = (locationId: string) => `laaw:calendar:v1:${locationId}`;

export function restoreCalendarAgenda(locationId: string, bundled: CalendarAgenda, now: number, storage?: Storage): CalendarAgenda {
  let current = getNewerCalendarAgenda({ [locationId]: lastGood.get(locationId) }, locationId, bundled, now);
  try {
    const saved = storage?.getItem(key(locationId));
    if (saved) current = getNewerCalendarAgenda({ [locationId]: JSON.parse(saved) }, locationId, current, now);
  } catch { /* Storage may be unavailable or corrupt; never discard good data. */ }
  lastGood.set(locationId, current);
  return current;
}

export function rememberCalendarAgenda(locationId: string, agenda: CalendarAgenda, storage?: Storage): void {
  lastGood.set(locationId, agenda);
  try { storage?.setItem(key(locationId), JSON.stringify(agenda)); }
  catch { /* Quota/private-mode failures must not break the live schedule. */ }
}
