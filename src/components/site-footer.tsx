"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { ThemeControl } from "@/src/components/theme-control";
import type { Location } from "@/src/domain/site";
import { getLocationPath } from "@/src/application/location-routing";

const presetAmounts = [1, 5, 7, 10, 20];

export function SiteFooter({ locations }: Readonly<{
  locations: readonly Pick<Location, "id" | "slug" | "displayName">[];
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef("");
  const [amount, setAmount] = useState("5");

  return (
    <>
      <footer className="site-footer" data-page-canvas="" data-page-interaction-surface="">
        <div className="site-footer-inner">
          <div>
            <p className="site-credit">
              Brewed by <a href="https://github.com/commander-clifford">Clifford</a>.
            </p>
            <p className="site-credit-note">A little code. Good company. Extra hops.</p>
          </div>
          <nav aria-label="Footer">
            {locations.map((location) => (
              <Link key={location.id} href={getLocationPath(location)}>{location.displayName}</Link>
            ))}
            <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/og/`}>OG Regular</a>
          </nav>
          <div className="site-footer-controls">
            <button
              className="tip-jar-trigger"
              type="button"
              onClick={() => {
                previousOverflow.current = document.body.style.overflow;
                document.body.style.overflow = "hidden";
                dialogRef.current?.showModal();
              }}
            >
              Buy Clifford a beer
            </button>
            <ThemeControl />
          </div>
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        className="tip-dialog"
        aria-labelledby="tip-dialog-title"
        aria-describedby="tip-dialog-description"
        onClose={() => { document.body.style.overflow = previousOverflow.current; }}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), a[href]',
          ));
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="tip-dialog-heading">
          <h2 id="tip-dialog-title">Buy Clifford a beer</h2>
          <button type="button" className="tip-dialog-close" aria-label="Close tip jar" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <p id="tip-dialog-description">A small cheers for the person keeping LAAW.life brewing.</p>
        <fieldset className="tip-amounts">
          <legend>Choose an amount · USD</legend>
          <div>
            {presetAmounts.map((preset) => (
              <button key={preset} type="button" aria-pressed={amount === String(preset)} onClick={() => setAmount(String(preset))}>
                ${preset}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="tip-custom-amount">
          <span>Custom amount (USD)</span>
          <input type="number" min="1" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </label>
        <p className="tip-availability">The tip jar is coming soon. Payments aren’t connected yet.</p>
        <button className="tip-checkout" type="button" disabled>Tip jar coming soon</button>
      </dialog>
    </>
  );
}
