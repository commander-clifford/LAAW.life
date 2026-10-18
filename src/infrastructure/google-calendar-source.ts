import { Buffer } from "node:buffer";

export type ParsedGoogleCalendarEmbed = Readonly<{
  calendarIds: readonly string[];
  calendarSources: readonly Readonly<{
    calendarId: string;
    color?: string;
  }>[];
  timeZone: string;
  url: URL;
}>;

export function normalizeGoogleCalendarColor(color: string | undefined): string | undefined {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : undefined;
}

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

  const rawCalendarSources = url.searchParams.getAll("src");
  const rawColors = url.searchParams.getAll("color");

  if (
    url.protocol !== "https:" ||
    url.hostname !== "calendar.google.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/calendar/embed" ||
    !rawCalendarSources.some((calendarId) => calendarId.trim().length > 0)
  ) {
    throw new Error("Invalid Google Calendar embed URL");
  }

  const timeZone = url.searchParams.get("ctz") ?? "UTC";
  validateTimeZone(timeZone);

  // Google embeds pair repeated color values with repeated src values. Missing
  // color entries make that positional relationship ambiguous, so retain colors
  // only when the complete mapping is present. Never infer Google's defaults.
  const hasCompleteColorMapping = rawColors.length === rawCalendarSources.length;
  const colorsByCalendarId = new Map<string, string | undefined>();
  const conflictingCalendarIds = new Set<string>();

  rawCalendarSources.forEach((rawSource, index) => {
    if (rawSource.trim().length === 0) return;
    const calendarId = decodeCalendarId(rawSource);
    const color = hasCompleteColorMapping
      ? normalizeGoogleCalendarColor(rawColors[index])
      : undefined;

    if (colorsByCalendarId.has(calendarId) && colorsByCalendarId.get(calendarId) !== color) {
      conflictingCalendarIds.add(calendarId);
    } else {
      colorsByCalendarId.set(calendarId, color);
    }
  });
  const calendarSources = [...colorsByCalendarId].map(([calendarId, color]) => ({
    calendarId,
    ...(color && !conflictingCalendarIds.has(calendarId) ? { color } : {}),
  }));

  return {
    calendarIds: calendarSources.map(({ calendarId }) => calendarId),
    calendarSources,
    timeZone,
    url,
  };
}
