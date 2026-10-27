import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 640, height: 480 } });
try {
  await p.goto("http://localhost:5173");
  await p.locator("[name=name]").fill("ฟิสิกส์");
  await p.locator("[name=number]").fill("1");
  await p.locator("form .primary").click();
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press("Space");
    await p.waitForFunction(
      () => window.__humidity.snapshot().position[1] > 0.1,
    );
    await p.waitForFunction(() => window.__humidity.snapshot().grounded);
    assert.equal(
      (await p.evaluate(() => window.__humidity.snapshot())).hearts,
      3,
    );
  }
  console.log("PASS five repeated jumps land on floor");
  await p.evaluate(() => window.__humidity.place(7, -12.7));
  await p.keyboard.press("Space");
  await p.keyboard.down("w");
  await p.waitForFunction(
    () => window.__humidity.snapshot().position[2] < -15.2,
  );
  await p.keyboard.up("w");
  await p.waitForFunction(() => window.__humidity.snapshot().grounded);
  assert.equal(
    (await p.evaluate(() => window.__humidity.snapshot())).hearts,
    3,
  );
  console.log("PASS real keyboard jump across 1.2m pit without damage");
  await p.evaluate(() => window.__humidity.place(-2.6, 0));
  await p.locator("[data-answer]").first().waitFor();
  await p.locator("#leave").click();
  await p.keyboard.down("s");
  await p.waitForFunction(() => window.__humidity.snapshot().position[2] > 1.6);
  await p.keyboard.up("s");
  assert.equal(await p.locator("#overlay").textContent(), "");
  console.log("PASS leave unanswered crystal and walk away");
} finally {
  await b.close();
}
