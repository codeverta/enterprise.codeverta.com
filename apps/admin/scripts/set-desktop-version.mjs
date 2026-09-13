import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2]?.replace(/^v/, "");
if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error("Use a semantic version, for example: pnpm desktop:version 0.0.2");
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(scriptDir, "..");

for (const relativePath of ["package.json", "src-tauri/tauri.conf.json"]) {
  const path = resolve(adminDir, relativePath);
  const data = JSON.parse(readFileSync(path, "utf8"));
  data.version = version;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

const cargoTomlPath = resolve(adminDir, "src-tauri/Cargo.toml");
const cargoToml = readFileSync(cargoTomlPath, "utf8").replace(
  /(^\[package\][\s\S]*?^version\s*=\s*")[^"]+("\s*$)/m,
  `$1${version}$2`,
);
writeFileSync(cargoTomlPath, cargoToml);

const cargoLockPath = resolve(adminDir, "src-tauri/Cargo.lock");
const cargoLock = readFileSync(cargoLockPath, "utf8").replace(
  /(\[\[package\]\]\nname = "codeverta-erp"\nversion = ")[^"]+("\n)/,
  `$1${version}$2`,
);
writeFileSync(cargoLockPath, cargoLock);

console.log(`Desktop application version is now ${version}.`);
