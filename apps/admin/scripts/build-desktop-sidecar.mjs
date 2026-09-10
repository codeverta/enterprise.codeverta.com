import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const adminDir = resolve(scriptDir, "..");
const backendDir = resolve(adminDir, "../backend");
const binariesDir = resolve(adminDir, "src-tauri/binaries");

const rustInfo = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
const targetTriple = rustInfo.match(/^host:\s+(\S+)$/m)?.[1];
if (!targetTriple) throw new Error("Unable to determine the Rust target triple.");

const extension = process.platform === "win32" ? ".exe" : "";
const output = resolve(binariesDir, `codeverta-backend-${targetTriple}${extension}`);
mkdirSync(binariesDir, { recursive: true });

console.log(`Building desktop offline backend for ${targetTriple}...`);
execFileSync("go", ["build", "-trimpath", "-ldflags", "-s -w", "-o", output, "."], {
  cwd: backendDir,
  env: { ...process.env, CGO_ENABLED: process.env.CGO_ENABLED || "1" },
  stdio: "inherit",
});
console.log(`Offline backend ready: ${output}`);
