/**
 * Accessibility and layout audit against the real static export.
 *
 * Runs axe-core over the deployed markup in both themes, and checks that the
 * page does not scroll sideways at phone width — the two failure modes that are
 * easy to introduce and invisible until someone else hits them.
 *
 * Exits non-zero on any serious or critical violation, so CI blocks on it.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_PATH = "/cadence";
const ROOT = fileURLToPath(new URL("../out/", import.meta.url));
const FIXED_TIME = new Date("2026-08-18T07:20:00Z");
const TIMEZONE = "Europe/Madrid";

/** Serious and critical are the levels worth failing a build over. */
const BLOCKING = new Set(["serious", "critical"]);

const VIEWPORTS = [
  { name: "desktop", width: 1380, height: 850 },
  { name: "phone", width: 375, height: 780 },
];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function serve(port) {
  const server = createServer(async (request, response) => {
    let path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    if (path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
    if (path === "" || path.endsWith("/")) path += "index.html";
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

const port = 4174;
const server = await serve(port);
const browser = await chromium.launch();
const failures = [];

try {
  for (const viewport of VIEWPORTS) {
    for (const colorScheme of ["dark", "light"]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme,
        reducedMotion: "reduce",
        timezoneId: TIMEZONE,
        locale: "en-GB",
      });
      await context.clock.setFixedTime(FIXED_TIME);

      const page = await context.newPage();
      await page.goto(`http://localhost:${port}${BASE_PATH}/`, { waitUntil: "networkidle" });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      for (const violation of results.violations) {
        const where = `${viewport.name}/${colorScheme}`;
        const line = `${where}: [${violation.impact}] ${violation.id} — ${violation.help} (${violation.nodes.length} node${violation.nodes.length === 1 ? "" : "s"})`;
        if (BLOCKING.has(violation.impact ?? "")) {
          failures.push(line);
          console.error(`FAIL ${line}`);
          for (const node of violation.nodes.slice(0, 3)) {
            console.error(`      ${node.target.join(" ")}`);
          }
        } else {
          console.warn(`warn ${line}`);
        }
      }

      // A page that scrolls sideways on a phone is a layout bug, not a taste
      // question, so it is checked rather than eyeballed.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (viewport.name === "phone" && overflow > 1) {
        const line = `${viewport.name}/${colorScheme}: the page scrolls ${overflow}px sideways`;
        failures.push(line);
        console.error(`FAIL ${line}`);
      }

      console.log(
        `checked ${viewport.name}/${colorScheme}: ${results.violations.length} finding(s), ${overflow}px horizontal overflow`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} blocking issue(s).`);
  process.exit(1);
}
console.log("\nNo serious or critical issues.");
