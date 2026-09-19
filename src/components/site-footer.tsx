"use client";

import { useRef } from "react";

export function SiteFooter() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOverflow = useRef("");

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
        aria-label="Clifford links"
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
          <button type="button" className="tip-dialog-close" aria-label="Close dialog" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <div className="profile-links">
          <a className="profile-link" href="https://www.instagram.com/ludocliff/">Instagram</a>
          <a className="profile-link" href="https://cash.app/$highestcliff">Buy me a brew</a>
        </div>
      </dialog>
    </>
  );
}
