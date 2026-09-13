import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(scriptDir, "..");
const tag = process.env.RELEASE_TAG?.trim();

if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error("RELEASE_TAG must use semantic version format, for example v0.0.2.");
}

const expectedVersion = tag.slice(1);
const packageVersion = JSON.parse(readFileSync(resolve(adminDir, "package.json"), "utf8")).version;
const tauriVersion = JSON.parse(readFileSync(resolve(adminDir, "src-tauri/tauri.conf.json"), "utf8")).version;
const cargoToml = readFileSync(resolve(adminDir, "src-tauri/Cargo.toml"), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

for (const [source, version] of [
  ["apps/admin/package.json", packageVersion],
  ["apps/admin/src-tauri/tauri.conf.json", tauriVersion],
  ["apps/admin/src-tauri/Cargo.toml", cargoVersion],
]) {
  if (version !== expectedVersion) {
    throw new Error(`${source} has version ${version}; expected ${expectedVersion} from ${tag}.`);
  }
}

if (!process.env.TAURI_SIGNING_PRIVATE_KEY) {
  throw new Error("GitHub secret TAURI_SIGNING_PRIVATE_KEY is required.");
}
if (process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD === undefined) {
  throw new Error("GitHub secret TAURI_SIGNING_PRIVATE_KEY_PASSWORD is required (it may be empty only for an unencrypted key).");
}

console.log(`Desktop release ${tag} is version-aligned and ready to build.`);
