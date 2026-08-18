/**
 * Regenerates docs/screenshot.png from the real application.
 *
 * The static export is served locally under the same base path GitHub Pages
 * uses, so the page under test is byte-for-byte what gets deployed. Everything
 * that could vary between runs is pinned: the clock, the timezone, the colour
 * scheme, and the motion preference. Without the fixed clock the countdowns
 * would differ on every run and CI would commit a new screenshot each time.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE_PATH = "/cadence";
// fileURLToPath, not URL.pathname: the latter yields "/C:/…" on Windows, which
// is not a path the filesystem will accept.
const ROOT = fileURLToPath(new URL("../out/", import.meta.url));
const OUTPUT = fileURLToPath(new URL("../docs/screenshot.png", import.meta.url));

const VIEWPORT = { width: 1380, height: 850 };
const FIXED_TIME = new Date("2026-08-18T07:20:00Z");
const TIMEZONE = "Europe/Madrid";
/** Rendered when the schedule has been parsed and the runs computed. */
const READY_SELECTOR = "text=At 09:30, Monday to Friday.";

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
    const url = new URL(request.url ?? "/", "http://localhost");
    let path = decodeURIComponent(url.pathname);

    if (path.startsWith(BASE_PATH)) path = path.slice(BASE_PATH.length);
    if (path === "" || path.endsWith("/")) path += "index.html";

    // Contain the path: a request must not escape the export directory.
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

const port = 4173;
const server = await serve(port);
const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: "dark",
    // The entrance animations collapse under this, so nothing is captured
    // mid-flight.
    reducedMotion: "reduce",
    timezoneId: TIMEZONE,
    locale: "en-GB",
  });

  await context.clock.setFixedTime(FIXED_TIME);

  const page = await context.newPage();
  const failures = [];
  page.on("requestfailed", (request) => failures.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`http://localhost:${port}${BASE_PATH}/`, { waitUntil: "networkidle" });
  await page.waitForSelector(READY_SELECTOR, { timeout: 15_000 });
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  if (failures.length > 0) {
    throw new Error(`The page did not load cleanly:\n  ${failures.join("\n  ")}`);
  }

  await page.screenshot({ path: OUTPUT });
  console.log(`Wrote ${OUTPUT}`);
} finally {
  await browser.close();
  server.close();
}
