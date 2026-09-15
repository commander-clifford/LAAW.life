import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const exportRoot = resolve(projectRoot, "out");
const requestedArchive = process.argv[2];

if (!requestedArchive?.endsWith(".tar.gz") || process.argv.length !== 3) {
  throw new Error("Usage: node scripts/package-hostgator-release.mjs /absolute/path/release.tar.gz");
}

const archivePath = resolve(requestedArchive);
const checksumPath = `${archivePath}.sha256`;
const relativeArchive = relative(exportRoot, archivePath);

if (relativeArchive !== ".." && !relativeArchive.startsWith(`..${sep}`)) {
  throw new Error("Save the release archive outside out/");
}

for (const filePath of [archivePath, checksumPath]) {
  try {
    await access(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      continue;
    }

    throw error;
  }

  throw new Error(`Refusing to overwrite ${filePath}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${command} failed with exit status ${result.status}`);
  }
}

// HostGator serves laaw.life at the domain root. Reject a Pages-prefixed build.
run(process.execPath, ["scripts/verify-static-export.mjs"], {
  env: { ...process.env, PAGES_BASE_PATH: "" },
});
await mkdir(dirname(archivePath), { recursive: true });
// Archiving '.' includes .htaccess and every _next file; a shell '*' would not.
run("tar", ["-czf", archivePath, "-C", exportRoot, "."], {
  env: { ...process.env, COPYFILE_DISABLE: "1" },
});
const archiveHash = createHash("sha256")
  .update(await readFile(archivePath))
  .digest("hex");
await writeFile(checksumPath, `${archiveHash}  ${basename(archivePath)}\n`, { flag: "wx" });
console.log(`Release package: ${archivePath}`);
console.log(`SHA-256: ${archiveHash}`);
