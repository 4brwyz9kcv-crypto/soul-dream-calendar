/**
 * Listet die Lizenzen aller installierten Pakete auf.
 *
 * Ohne Zusatzpaket: liest die package.json jedes Ordners unter node_modules.
 * `--prod` beschraenkt auf das, was tatsaechlich ausgeliefert wird.
 *
 * Aufruf: `npm run licenses` bzw. `npm run licenses -- --prod`
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MODULES = join(ROOT, "node_modules");
const prodOnly = process.argv.includes("--prod");

const manifest = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const wanted = new Set(
  Object.keys(manifest.dependencies ?? {}).concat(
    prodOnly ? [] : Object.keys(manifest.devDependencies ?? {})
  )
);

async function packagesIn(dir, prefix = "") {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".bin") continue;
    // Scoped Pakete (@scope/name) liegen eine Ebene tiefer.
    if (entry.name.startsWith("@")) {
      found.push(...(await packagesIn(join(dir, entry.name), `${entry.name}/`)));
      continue;
    }
    try {
      const pkg = JSON.parse(await readFile(join(dir, entry.name, "package.json"), "utf8"));
      found.push({
        name: `${prefix}${entry.name}`,
        version: pkg.version ?? "?",
        license: pkg.license ?? pkg.licenses?.[0]?.type ?? "UNBEKANNT"
      });
    } catch {
      // Kein Paket oder unlesbar - ueberspringen.
    }
  }
  return found;
}

const all = await packagesIn(MODULES);
const direct = all.filter((pkg) => wanted.has(pkg.name)).sort((a, b) => a.name.localeCompare(b.name));

console.log(`\n${prodOnly ? "Laufzeit" : "Alle direkten"}-Abhaengigkeiten (${direct.length}):\n`);
for (const pkg of direct) {
  console.log(`  ${pkg.name.padEnd(28)} ${pkg.version.padEnd(12)} ${pkg.license}`);
}

const counts = new Map();
for (const pkg of all) counts.set(pkg.license, (counts.get(pkg.license) ?? 0) + 1);
console.log(`\nGesamter Baum (${all.length} Pakete) nach Lizenz:\n`);
for (const [license, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${license}`);
}

const unknown = all.filter((pkg) => pkg.license === "UNBEKANNT");
if (unknown.length > 0) {
  console.log(`\nOhne Lizenzangabe (${unknown.length}): ${unknown.map((p) => p.name).join(", ")}`);
}
console.log();
