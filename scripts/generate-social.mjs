import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL("./social-card.html", import.meta.url).href);
  await page.locator(".monkey > svg").waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("../social-card.png", import.meta.url)) });
} finally {
  await browser.close();
}
