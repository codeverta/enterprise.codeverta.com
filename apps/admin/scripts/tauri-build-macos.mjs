import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const adminDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localKeyPath = resolve(adminDir, ".tauri", "codeverta-erp.key");
const configuredKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();

function readKeyFile(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

let privateKey = configuredKey;

if (configuredKey) {
  const configuredPath = resolve(adminDir, configuredKey);
  privateKey = readKeyFile(configuredKey) ?? readKeyFile(configuredPath) ?? configuredKey;
} else {
  privateKey = readKeyFile(localKeyPath);
}

if (!privateKey) {
  throw new Error(
    `Tauri signing key tidak ditemukan. Letakkan private key di ${localKeyPath} atau set TAURI_SIGNING_PRIVATE_KEY.`,
  );
}

const result = spawnSync("pnpm", ["exec", "tauri", "build", "--bundles", "app,dmg"], {
  cwd: adminDir,
  env: {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: privateKey,
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
