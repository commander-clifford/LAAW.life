import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { appendFile } from "node:fs/promises";

import { laawLifeTenant } from "../src/config/laaw-life.ts";
import { parseGoogleCalendarEmbed } from "../src/infrastructure/google-calendar-source.ts";

const requestTimeoutMilliseconds = 20_000;
const maximumFeedBytes = 10_000_000;
const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1_000;

function buildPublicCalendarFeedUrl(calendarId) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

const calendarIds = [
  ...new Set(
    laawLifeTenant.locations.flatMap((location) => {
      return parseGoogleCalendarEmbed(location.calendar.src).calendarIds;
    }),
  ),
].toSorted();

const feedDocuments = await Promise.all(
  calendarIds.map(async (calendarId) => {
    const response = await fetch(buildPublicCalendarFeedUrl(calendarId), {
      headers: {
        Accept: "text/calendar",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(requestTimeoutMilliseconds),
    });
    const body = await response.text();

    if (
      !response.ok ||
      Buffer.byteLength(body, "utf8") > maximumFeedBytes ||
      !body.includes("BEGIN:VCALENDAR")
    ) {
      throw new Error(
        `A public calendar feed could not be read (HTTP ${response.status})`,
      );
    }

    return `${calendarId}\0${body}`;
  }),
);
const freshnessBucket = Math.floor(Date.now() / millisecondsPerWeek);
const fingerprint = createHash("sha256")
  .update(`freshness-week:${freshnessBucket}\0`)
  .update(feedDocuments.join("\0"))
  .digest("hex");
const githubOutput = process.env.GITHUB_OUTPUT;

if (githubOutput) {
  await appendFile(githubOutput, `fingerprint=${fingerprint}\n`, "utf8");
}

console.log(
  `Fingerprint ${fingerprint} covers ${calendarIds.length} public calendar feeds.`,
);
