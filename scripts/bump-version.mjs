import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function normalizeVersion(version) {
  const match = String(version || "").match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid version: ${version}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  minor += Math.floor(patch / 10);
  patch %= 10;
  return `${major}.${minor}.${patch}`;
}

function nextVersion(version) {
  const match = normalizeVersion(version).match(/^(\d+)\.(\d+)\.(\d+)$/);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]) + 1;
  if (patch >= 10) {
    minor += 1;
    patch = 0;
  }
  return `${major}.${minor}.${patch}`;
}

async function updateJson(fileName, version) {
  const filePath = path.join(root, fileName);
  const json = JSON.parse(await readFile(filePath, "utf8"));
  json.version = version;
  if (json.packages?.[""]) json.packages[""].version = version;
  await writeFile(filePath, `${JSON.stringify(json, null, 4)}\n`, "utf8");
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const version = nextVersion(packageJson.version);

await updateJson("package.json", version);
await updateJson("package-lock.json", version);

console.log(version);
