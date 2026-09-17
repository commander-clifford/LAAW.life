"use client";

import { useId, useState } from "react";

import { CalendarEmbed } from "@/src/components/calendar-embed";

export function CalendarDisclosure({ src, title }: Readonly<{ src: string; title: string }>) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const panelId = useId();

  return (
    <section className="calendar-disclosure" aria-label="Full calendar">
      <button
        className="calendar-disclosure-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setHasOpened(true);
          setIsOpen((open) => !open);
        }}
      >
        {isOpen ? "Close calendar" : "Open calendar"}
      </button>
      <div id={panelId} hidden={!isOpen}>
        {hasOpened ? <CalendarEmbed src={src} title={title} /> : null}
      </div>
    </section>
  );
}
