import { chromium } from "@playwright/test";

import { laawLifeTenant } from "../src/config/laaw-life.ts";

const navigationTimeoutMilliseconds = 30_000;
const calendarRenderDelayMilliseconds = 3_000;
const parallelChecks = 3;

function decodeCalendarId(encodedCalendarId) {
  return Buffer.from(encodedCalendarId, "base64").toString("utf8");
}

function buildSingleCalendarUrl(encodedCalendarId) {
  const url = new URL("https://calendar.google.com/calendar/embed");
  url.searchParams.set("mode", "AGENDA");
  url.searchParams.set("ctz", "America/Los_Angeles");
  url.searchParams.set("src", encodedCalendarId);
  return url.href;
}

function buildPublicCalendarFeedUrl(calendarId) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

const calendarOwners = new Map();

for (const location of laawLifeTenant.locations) {
  const url = new URL(location.calendar.src);

  for (const source of url.searchParams.getAll("src")) {
    const owners = calendarOwners.get(source) ?? [];
    owners.push(location.displayName);
    calendarOwners.set(source, owners);
  }
}

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  const calendars = [...calendarOwners.entries()];

  for (let index = 0; index < calendars.length; index += parallelChecks) {
    const batch = calendars.slice(index, index + parallelChecks);

    results.push(
      ...(await Promise.all(
        batch.map(async ([source, owners]) => {
          const context = await browser.newContext();
          const calendarId = decodeCalendarId(source);

          try {
            const feedResponse = await fetch(buildPublicCalendarFeedUrl(calendarId), {
              redirect: "follow",
              signal: AbortSignal.timeout(navigationTimeoutMilliseconds),
            });
            const feedBody = await feedResponse.text();
            const feedContentType = feedResponse.headers.get("content-type") ?? "";

            if (
              feedResponse.status !== 200 ||
              !feedContentType.startsWith("text/calendar") ||
              !feedBody.includes("BEGIN:VCALENDAR")
            ) {
              throw new Error(
                `public iCalendar feed returned HTTP ${feedResponse.status} as ${feedContentType || "an unknown content type"}`,
              );
            }

            const page = await context.newPage();
            const response = await page.goto(buildSingleCalendarUrl(source), {
              timeout: navigationTimeoutMilliseconds,
              waitUntil: "domcontentloaded",
            });
            await page.waitForTimeout(calendarRenderDelayMilliseconds);

            const title = await page.title();
            const bodyText = await page.locator("body").innerText();
            const finalHost = new URL(page.url()).hostname;
            const isSignInPage =
              finalHost === "accounts.google.com" ||
              /sign in to continue to google calendar/i.test(bodyText) ||
              /sign in to access/i.test(title);
            const status = response?.status() ?? 0;

            if (status >= 400 || finalHost !== "calendar.google.com" || isSignInPage) {
              throw new Error(
                `anonymous request ended at ${finalHost} with HTTP ${status} (${title || "untitled page"})`,
              );
            }

            return {
              calendarId,
              owners,
              title,
            };
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(
              `${owners.join(", ")} feed ${calendarId} is not anonymously available: ${reason}`,
            );
          } finally {
            await context.close();
          }
        }),
      )),
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}

if (process.exitCode !== 1) {
  for (const result of results) {
    console.log(`PASS ${result.title} (${result.owners.join(", ")})`);
  }

  console.log(`Verified ${results.length} calendars in anonymous browser contexts.`);
}
