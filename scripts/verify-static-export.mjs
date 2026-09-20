import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative } from "node:path";

const exportDirectory = new URL("../out/", import.meta.url);
const configuredBasePath = process.env.PAGES_BASE_PATH?.trim() ?? "";
const basePath = configuredBasePath
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`
  : "";
// Matches the original source and the public Apache homepage on 2026-09-15.
const originalHtmlSha256 =
  "89498f5e44981f74607672dbfffb8c98800e20c5d36b350590b73c2d5ede343f";
const requiredFiles = [
  ".htaccess",
  "index.html",
  "404.html",
  "ivy/index.html",
  "hawthorne/index.html",
  "og/index.html",
  "calendar-data/agendas.json",
];
const inspectableExtensions = new Set([".css", ".html", ".js", ".json", ".txt"]);
const forbiddenContent = ["Clifford gets free beer"];
const expectedPageContent = new Map([
  [
    "index.html",
    [
      "<title>Choose a location | LAAW Life</title>",
      "Choose a location",
      "Ivy Station",
      "Hawthorne",
    ],
  ],
  [
    "ivy/index.html",
    [
      "<title>Ivy Station Calendar | LAAW Life</title>",
      '<meta name="description" content="View the Ivy Station calendar for LAAW Life."',
      '<section class="day-carousel" aria-label="Seven-day schedule"',
    ],
  ],
  [
    "hawthorne/index.html",
    [
      "<title>Hawthorne Calendar | LAAW Life</title>",
      '<meta name="description" content="View the Hawthorne calendar for LAAW Life."',
      '<section class="day-carousel" aria-label="Seven-day schedule"',
    ],
  ],
  [
    "404.html",
    [
      "<title>Page not found | LAAW Life</title>",
      '<meta name="description" content="Choose a LAAW Life location to find the calendar you need."',
      "Page not found",
      "View Ivy Station calendar",
      "View Hawthorne calendar",
      'name="robots" content="noindex"',
    ],
  ],
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);

      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );

  return nestedFiles.flat();
}

for (const requiredFile of requiredFiles) {
  const file = new URL(requiredFile, exportDirectory);

  if (!(await stat(file)).isFile()) {
    throw new Error(`Static export is missing ${requiredFile}`);
  }
}

for (const [relativePath, expectedValues] of expectedPageContent) {
  const contents = await readFile(new URL(relativePath, exportDirectory), "utf8");

  for (const expectedValue of [...expectedValues, `href="${basePath}/og/"`]) {
    if (!contents.includes(expectedValue)) {
      throw new Error(
        `Static export ${relativePath} is missing expected content: ${expectedValue}`,
      );
    }
  }

  const assetReferences = [
    ...contents.matchAll(/(?:src|href)="([^"]*\/_next\/[^"]*)"/g),
  ];

  if (assetReferences.length === 0) {
    throw new Error(`Static export ${relativePath} has no Next.js assets`);
  }

  for (const [, assetReference] of assetReferences) {
    if (!assetReference.startsWith(`${basePath}/_next/`)) {
      throw new Error(`Static export ${relativePath} has the wrong asset base path`);
    }

    const assetPath = decodeURIComponent(assetReference.split(/[?#]/, 1)[0])
      .slice(basePath.length + 1);

    if (!(await stat(new URL(assetPath, exportDirectory))).isFile()) {
      throw new Error(`Static export ${relativePath} is missing asset ${assetPath}`);
    }
  }
}

for (const originalFile of [
  new URL("../public/og/index.html", import.meta.url),
  new URL("og/index.html", exportDirectory),
]) {
  const hash = createHash("sha256").update(await readFile(originalFile)).digest("hex");

  if (hash !== originalHtmlSha256) {
    throw new Error("The OG page must preserve the authentic original HTML byte-for-byte");
  }
}

const apacheSource = await readFile(new URL("../public/.htaccess", import.meta.url));
const apacheExport = await readFile(new URL(".htaccess", exportDirectory));

if (!apacheSource.equals(apacheExport)) {
  throw new Error("Static export is missing the current Apache route configuration");
}

const generatedAgendas = await readFile(new URL("../.calendar-data/agendas.json", import.meta.url));
const exportedAgendas = await readFile(new URL("calendar-data/agendas.json", exportDirectory));

if (!generatedAgendas.equals(exportedAgendas)) {
  throw new Error("Published calendar data differs from the generated build snapshot");
}

const agendas = JSON.parse(exportedAgendas.toString("utf8"));
const expectedSources = new Map([["ivy-station", 8], ["hawthorne", 8]]);
const millisecondsPerDay = 24 * 60 * 60 * 1_000;
const now = Date.now();
const pacificDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pacificDateKey(timestamp) {
  const parts = Object.fromEntries(
    pacificDateFormatter.formatToParts(timestamp).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyAfter(dateKey, days) {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * millisecondsPerDay)
    .toISOString().slice(0, 10);
}

if (!isRecord(agendas) || Object.keys(agendas).length !== expectedSources.size) {
  throw new Error("Published calendar data must contain both configured locations");
}

for (const [locationId, sourceCount] of expectedSources) {
  const agenda = agendas[locationId];
  const generatedAt = typeof agenda?.generatedAt === "string"
    ? Date.parse(agenda.generatedAt)
    : NaN;

  if (
    !isRecord(agenda) ||
    !Number.isFinite(generatedAt) ||
    now - generatedAt > 2 * millisecondsPerDay ||
    generatedAt - now > 5 * 60 * 1_000 ||
    agenda.timeZone !== "America/Los_Angeles" ||
    agenda.sourceCount !== sourceCount ||
    agenda.failedSourceCount !== 0
  ) {
    throw new Error(`Calendar data for ${locationId} must be fresh and include every public feed`);
  }

  const initialDateKey = pacificDateKey(generatedAt);
  const expectedDateKeys = Array.from({ length: 37 }, (_, index) =>
    dateKeyAfter(initialDateKey, index - 1),
  );

  if (
    agenda.initialDateKey !== initialDateKey ||
    !Array.isArray(agenda.availableDateKeys) ||
    agenda.availableDateKeys.length !== expectedDateKeys.length ||
    !expectedDateKeys.every((dateKey, index) => agenda.availableDateKeys[index] === dateKey) ||
    !agenda.availableDateKeys.includes(pacificDateKey(now)) ||
    !agenda.availableDateKeys.includes(dateKeyAfter(pacificDateKey(now), 1))
  ) {
    throw new Error(`Calendar data for ${locationId} must cover yesterday through 35 days after generation`);
  }

  if (!Array.isArray(agenda.events) || agenda.events.some((event) => (
    !isRecord(event) ||
    typeof event.allDay !== "boolean" ||
    typeof event.id !== "string" || !event.id.trim() ||
    typeof event.title !== "string" || !event.title.trim() ||
    typeof event.sourceName !== "string" ||
    (event.location !== null && typeof event.location !== "string") ||
    typeof event.start !== "string" || !Number.isFinite(Date.parse(event.start)) ||
    typeof event.end !== "string" || !Number.isFinite(Date.parse(event.end)) ||
    Date.parse(event.end) < Date.parse(event.start) ||
    !Array.isArray(event.dateKeys) || event.dateKeys.length === 0 ||
    !event.dateKeys.every((dateKey) => agenda.availableDateKeys.includes(dateKey))
  ))) {
    throw new Error(`Calendar data for ${locationId} contains invalid event records`);
  }
}

const files = await listFiles(exportDirectory);
const developmentFiles = files.filter((file) =>
  relative(exportDirectory.pathname, file.pathname)
    .split("/")
    .includes("dev"),
);
const sourceMaps = files.filter((file) => extname(file.pathname) === ".map");

if (developmentFiles.length > 0) {
  throw new Error(
    `Static export contains development files:\n${developmentFiles
      .map((file) => relative(exportDirectory.pathname, file.pathname))
      .join("\n")}`,
  );
}

if (sourceMaps.length > 0) {
  throw new Error(
    `Static export contains source maps:\n${sourceMaps
      .map((file) => relative(exportDirectory.pathname, file.pathname))
      .join("\n")}`,
  );
}

for (const file of files) {
  if (!inspectableExtensions.has(extname(file.pathname))) {
    continue;
  }

  const contents = await readFile(file, "utf8");

  for (const forbiddenValue of forbiddenContent) {
    if (contents.includes(forbiddenValue)) {
      throw new Error(
        `Static export contains forbidden stale content in ${relative(
          exportDirectory.pathname,
          file.pathname,
        )}`,
      );
    }
  }
}

console.log(`Verified ${files.length} production files in out/.`);
