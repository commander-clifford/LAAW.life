"use client";

import "./calendar-embed.css";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

const slowLoadDelayMilliseconds = 10_000;

type CalendarStatus = "error" | "loading" | "ready" | "slow";

type CalendarEmbedProps = Readonly<{
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

export function CalendarEmbed({ src, title }: CalendarEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const isClientReady = useSyncExternalStore(
    subscribeToClientReadiness,
    getClientReadiness,
    getServerReadiness,
  );
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<CalendarStatus>("loading");
  const isLoading = status === "loading";

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
    <div className="calendar-shell" aria-busy={isLoading} data-calendar-status={status}>
      <div className="calendar-frame-stage">
        <p
          className="calendar-status calendar-loading-notice"
        hidden={status === "ready"}
        role={status === "ready" ? undefined : "status"}
        aria-live={status === "ready" ? undefined : "polite"}
      >
        <strong>{statusMessages[status]}</strong>
        <span>
          {status === "loading" ? "Connecting to Google Calendar. Your calendar will appear here." :
            status === "slow" ? "You can keep waiting, reload, or open the calendar in a new tab." :
            "Try reloading, or open Google Calendar directly."}
        </span>
        </p>
        {isClientReady ? (
          <iframe
            key={attempt}
            ref={frameRef}
            className="calendar-frame"
            onLoad={() => setStatus("ready")}
            referrerPolicy="strict-origin-when-cross-origin"
            src={src}
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
        <div className="calendar-recovery calendar-recovery-stable">
          <p className="calendar-embed-help">If events are missing or the calendar stays blank, open Google Calendar directly.</p>
          <button
            className="calendar-retry"
            type="button"
            onClick={reloadCalendar}
          >
            Reload calendar
          </button>
          <a href={src} target="_blank" rel="noreferrer">
            Open in Google Calendar
          </a>
        </div>
    </div>
  );
}
