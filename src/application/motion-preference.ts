export const motionStorageKey = "laaw-life:motion:v1";
export type MotionPreference = "system" | "reduce";

export function validMotionPreference(value: string | null | undefined): MotionPreference {
  return value === "reduce" ? "reduce" : "system";
}

export function shouldReduceMotion(): boolean {
  return document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function subscribeToMotionPreference(notify: () => void): () => void {
  const device = window.matchMedia("(prefers-reduced-motion: reduce)");
  const syncStorage = (event: StorageEvent) => {
    if (event.key === motionStorageKey || event.key === null) {
      document.documentElement.dataset.motion = validMotionPreference(event.newValue);
      notify();
    }
  };
  device.addEventListener("change", notify);
  window.addEventListener("laaw-motion-change", notify);
  window.addEventListener("storage", syncStorage);
  return () => {
    device.removeEventListener("change", notify);
    window.removeEventListener("laaw-motion-change", notify);
    window.removeEventListener("storage", syncStorage);
  };
}
