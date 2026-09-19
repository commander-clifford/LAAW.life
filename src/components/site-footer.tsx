"use client";

import { useRef, useState } from "react";

const presetAmounts = [1, 5, 7, 10, 20];

export function SiteFooter() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef("");
  const [amount, setAmount] = useState("5");
  const [showTip, setShowTip] = useState(false);

  return (
    <>
      <footer className="site-footer" data-page-canvas="" data-page-interaction-surface="">
        <div className="site-footer-inner">
          <p className="site-credit">
            Brewed by <a
              className="credit-link"
              href="https://www.instagram.com/ludocliff/"
              aria-haspopup="dialog"
              onClick={(event) => {
                event.preventDefault();
                setShowTip(false);
                previousOverflow.current = document.body.style.overflow;
                document.body.style.overflow = "hidden";
                dialogRef.current?.showModal();
              }}
            >
              Clifford
            </a>.
          </p>
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        className="tip-dialog"
        aria-label={showTip ? undefined : "Clifford links"}
        aria-labelledby={showTip ? "tip-dialog-title" : undefined}
        aria-describedby={showTip ? "tip-dialog-description" : undefined}
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
          {showTip ? <h2 id="tip-dialog-title">Buy me a brew</h2> : null}
          <button ref={closeButtonRef} type="button" className="tip-dialog-close" aria-label="Close dialog" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        {showTip ? (
          <>
            <button className="profile-back" type="button" onClick={() => {
              setShowTip(false);
              closeButtonRef.current?.focus();
            }}>Back to links</button>
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
          </>
        ) : (
          <div className="profile-links">
            <a className="profile-link" href="https://www.instagram.com/ludocliff/">Instagram</a>
            <button className="profile-link" type="button" onClick={() => {
              setShowTip(true);
              closeButtonRef.current?.focus();
            }}>Buy me a brew</button>
          </div>
        )}
      </dialog>
    </>
  );
}
