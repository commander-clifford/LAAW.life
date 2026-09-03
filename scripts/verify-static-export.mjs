import { readdir, readFile, stat } from "node:fs/promises";
import { extname, relative } from "node:path";

const exportDirectory = new URL("../out/", import.meta.url);
const requiredFiles = [
  "index.html",
  "404.html",
  "ivy/index.html",
  "hawthorne/index.html",
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
    ],
  ],
  [
    "hawthorne/index.html",
    [
      "<title>Hawthorne Calendar | LAAW Life</title>",
      '<meta name="description" content="View the Hawthorne calendar for LAAW Life."',
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

  for (const expectedValue of expectedValues) {
    if (!contents.includes(expectedValue)) {
      throw new Error(
        `Static export ${relativePath} is missing expected content: ${expectedValue}`,
      );
    }
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
