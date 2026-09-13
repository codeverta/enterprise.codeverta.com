import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const publicDir = resolve(process.cwd(), "public");
const distDir = resolve(process.cwd(), "dist");
const requiredAssets = ["sprites/whaledou/pet.json"];

for (const relativePath of requiredAssets) {
  const source = resolve(publicDir, relativePath);
  const target = resolve(distDir, relativePath);
  if (!existsSync(source)) {
    throw new Error(`Missing public asset: ${source}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  if (!existsSync(target)) {
    cpSync(source, target);
  }
}

console.log(`Verified ${requiredAssets.length} public asset(s) for Tauri.`);
