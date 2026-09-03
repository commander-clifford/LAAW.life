"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const slowLoadDelayMilliseconds = 10_000;

type CalendarStatus = "error" | "loading" | "ready" | "slow";

type CalendarEmbedProps = Readonly<{
  fallbackHref: string;
  src: string;
  title: string;
}>;

const statusMessages: Readonly<Record<CalendarStatus, string>> = {
  error: "The embedded calendar could not load.",
  loading: "Loading calendar…",
  ready: "",
  slow: "The calendar is taking longer than expected.",
};

function subscribeToClientReadiness(): () => void {
  return () => undefined;
}

function getClientReadiness(): boolean {
  return true;
}

function getServerReadiness(): boolean {
  return false;
}

export function CalendarEmbed({
  fallbackHref,
  src,
  title,
}: CalendarEmbedProps) {
  const helpId = useId();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const isClientReady = useSyncExternalStore(
    subscribeToClientReadiness,
    getClientReadiness,
    getServerReadiness,
  );
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CalendarStatus>("loading");
  const canRetry = status === "error" || status === "slow";
  const isLoading = status === "loading";
  const isFrameConcealed = status === "error" || isLoading;

  useEffect(() => {
    if (!isClientReady || status !== "loading") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus("slow");
    }, slowLoadDelayMilliseconds);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [attempt, isClientReady, status]);

  useEffect(() => {
    const frame = frameRef.current;

    if (!isClientReady || !frame) {
      return;
    }

    const handleError = () => setStatus("error");
    frame.addEventListener("error", handleError);

    return () => frame.removeEventListener("error", handleError);
  }, [attempt, isClientReady]);

  const reloadCalendar = () => {
    setStatus("loading");
    setAttempt((currentAttempt) => currentAttempt + 1);
  };

  return (
    <div className="calendar-shell" aria-busy={isLoading}>
      <p
        className="calendar-status"
        role={status === "ready" ? undefined : "status"}
        aria-live={status === "ready" ? undefined : "polite"}
      >
        {statusMessages[status] || "\u00a0"}
      </p>
      <div className="calendar-frame-stage">
        {isClientReady ? (
          <iframe
            key={attempt}
            ref={frameRef}
            aria-describedby={helpId}
            aria-hidden={isFrameConcealed || undefined}
            className={`calendar-frame${
              isFrameConcealed ? " calendar-frame-concealed" : ""
            }`}
            onLoad={() => setStatus("ready")}
            referrerPolicy="strict-origin-when-cross-origin"
            src={src}
            tabIndex={isFrameConcealed ? -1 : undefined}
            title={title}
          />
        ) : (
          <div
            aria-hidden="true"
            className="calendar-frame calendar-frame-placeholder"
            data-calendar-placeholder=""
          />
        )}
      </div>
      <div className="calendar-recovery" id={helpId}>
        <p>
          Times are shown in Pacific Time. Trouble viewing the embed?{" "}
          <a
            className="calendar-link"
            href={fallbackHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open the calendar in a new tab
          </a>
          .
        </p>
        {canRetry ? (
          <button
            className="calendar-retry"
            type="button"
            onClick={reloadCalendar}
          >
            Reload calendar
          </button>
        ) : null}
      </div>
    </div>
  );
}
