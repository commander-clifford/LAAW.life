import type { CalendarProvider } from "@/src/application/ports";

export const googleCalendarEmbedProvider: CalendarProvider = {
  getEmbed(source) {
    if (source.provider !== "google-calendar-embed") {
      throw new Error(`Unsupported calendar provider: ${source.provider}`);
    }

    return { src: source.src };
  },
};
