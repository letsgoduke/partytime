// Render the repository's vector mark into standard PWA PNG sizes; no remote assets.
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
const svg = await readFile(
  new URL("../public/icon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({
      path: fileURLToPath(
        new URL(`../public/icon-${size}.png`, import.meta.url),
      ),
      omitBackground: true,
    });
  }
} finally {
  await browser.close();
}
