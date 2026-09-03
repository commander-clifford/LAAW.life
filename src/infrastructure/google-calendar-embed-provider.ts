import type { CalendarProvider } from "@/src/application/ports";

function validateGoogleCalendarEmbed(sourceUrl: string): void {
  let url: URL;

  try {
    url = new URL(sourceUrl);
  } catch {
    throw new Error("Invalid Google Calendar embed URL");
  }

  const calendarIds = url.searchParams
    .getAll("src")
    .filter((calendarId) => calendarId.trim().length > 0);

  if (
    url.protocol !== "https:" ||
    url.hostname !== "calendar.google.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/calendar/embed" ||
    calendarIds.length === 0
  ) {
    throw new Error("Invalid Google Calendar embed URL");
  }
}

export const googleCalendarEmbedProvider: CalendarProvider = {
  getEmbed(source) {
    if (source.provider !== "google-calendar-embed") {
      throw new Error(`Unsupported calendar provider: ${source.provider}`);
    }

    validateGoogleCalendarEmbed(source.src);

    return {
      fallbackHref: source.src,
      src: source.src,
    };
  },
};
