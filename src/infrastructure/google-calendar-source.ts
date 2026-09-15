import { Buffer } from "node:buffer";

export type ParsedGoogleCalendarEmbed = Readonly<{
  calendarIds: readonly string[];
  timeZone: string;
  url: URL;
}>;

function validateTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new Error("Invalid Google Calendar time zone");
  }
}

function decodeCalendarId(source: string): string {
  const decoded = source.includes("@")
    ? source
    : Buffer.from(source, "base64").toString("utf8");
  const calendarId = decoded.trim();

  if (
    calendarId !== decoded ||
    !calendarId.includes("@") ||
    /[\u0000-\u001f\u007f]/u.test(calendarId)
  ) {
    throw new Error("Invalid Google Calendar ID");
  }

  return calendarId;
}

export function parseGoogleCalendarEmbed(
  sourceUrl: string,
): ParsedGoogleCalendarEmbed {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Invalid Google Calendar embed URL");
  }

  const calendarSources = url.searchParams
    .getAll("src")
    .filter((calendarId) => calendarId.trim().length > 0);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "calendar.google.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/calendar/embed" ||
    calendarSources.length === 0
  ) {
    throw new Error("Invalid Google Calendar embed URL");
  }

  const timeZone = url.searchParams.get("ctz") ?? "UTC";
  validateTimeZone(timeZone);

  return {
    calendarIds: [...new Set(calendarSources.map(decodeCalendarId))],
    timeZone,
    url,
  };
}
