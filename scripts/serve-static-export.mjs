import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const exportRoot = resolve(fileURLToPath(new URL("../out/", import.meta.url)));
const host = process.env.PREVIEW_HOST ?? "127.0.0.1";
const port = Number(process.env.PREVIEW_PORT ?? 4173);
const configuredBasePath =
  process.env.PREVIEW_BASE_PATH ?? process.env.PLAYWRIGHT_BASE_PATH ?? "";
const previewBasePath = configuredBasePath.trim()
  ? `/${configuredBasePath.trim().replace(/^\/+|\/+$/g, "")}`
  : "";
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff2", "font/woff2"],
]);

async function findFile(pathname) {
  if (
    previewBasePath &&
    pathname !== previewBasePath &&
    !pathname.startsWith(`${previewBasePath}/`)
  ) {
    return null;
  }

  const unprefixedPath = previewBasePath
    ? pathname.slice(previewBasePath.length)
    : pathname;
  const relativePath = decodeURIComponent(unprefixedPath).replace(/^\/+/, "");
  const candidates =
    relativePath === ""
      ? ["index.html"]
      : relativePath.endsWith("/")
        ? [`${relativePath}index.html`]
        : [relativePath, `${relativePath}.html`, `${relativePath}/index.html`];

  for (const candidate of candidates) {
    const filePath = resolve(exportRoot, candidate || "index.html");

    if (!filePath.startsWith(`${exportRoot}${sep}`)) {
      continue;
    }

    try {
      if ((await stat(filePath)).isFile()) {
        return filePath;
      }
    } catch {
      // Try the next static-route representation.
    }
  }

  return null;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", `http://${host}`).pathname;
    const requestedFile = await findFile(pathname);
    const filePath = requestedFile ?? resolve(exportRoot, "404.html");
    const statusCode = requestedFile ? 200 : 404;

    response.writeHead(statusCode, {
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad request");
  }
});

server.listen(port, host, () => {
  console.log(`Serving out/ at http://${host}:${port}${previewBasePath || "/"}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
