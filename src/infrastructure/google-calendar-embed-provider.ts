import type { CalendarEmbedProvider } from "@/src/application/ports";
import { parseGoogleCalendarEmbed } from "@/src/infrastructure/google-calendar-source";

export const googleCalendarEmbedProvider: CalendarEmbedProvider = {
  getEmbed(source) {
    if (source.provider !== "google-calendar-embed") {
      throw new Error(`Unsupported calendar provider: ${source.provider}`);
    }

    const { url } = parseGoogleCalendarEmbed(source.src);

    return {
      src: url.href,
    };
  },
};
