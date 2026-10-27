// Run against npm run dev. Test placement helpers exist only in Vite development mode.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { stages } from "../src/data.js";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const snap = () => page.evaluate(() => window.__humidity.snapshot());
const place = async (x, z) => {
  await page.evaluate(([x, z]) => window.__humidity.place(x, z), [x, z]);
  await page.waitForTimeout(300);
};
try {
  await page.goto("http://localhost:5173");
  await page.locator("[name=name]").fill("นักเวท ทดสอบ");
  await page.locator("[name=number]").fill("7");
  await page.locator("form .primary").click();
  await page.waitForFunction(() => window.__humidity.snapshot().state !== null);
  console.log("PASS signup and 3D runtime");
  await page.locator("#pause").click();
  await page.locator("#quality").click();
  await page.locator("#continue").click();
  const z = (await snap()).position[2];
  await page.keyboard.down("w");
  await page.waitForFunction(
    (z) => window.__humidity.snapshot().position[2] < z - 0.5,
    z,
  );
  await page.keyboard.up("w");
  console.log("PASS walking");
  const before = (await snap()).position[2];
  await page.keyboard.down("Shift");
  await page.keyboard.down("w");
  await page.waitForFunction(
    (z) => window.__humidity.snapshot().position[2] < z - 0.5,
    before,
  );
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  console.log("PASS run input");
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => window.__humidity.snapshot().position[1] > 0.15,
  );
  await page.waitForFunction(() => window.__humidity.snapshot().grounded);
  console.log("PASS jump and landing");
  await place(0, 6);
  await page.waitForFunction(
    () => window.__humidity.snapshot().state.coins.length > 0,
  );
  console.log("PASS coin collection");
  await place(7, -14);
  await page.waitForFunction(() => window.__humidity.snapshot().hearts === 2);
  assert.equal((await snap()).position[1], 0);
  console.log("PASS pit damage and safe respawn");
  for (let level = 0; level < 7; level++) {
    for (let i = 0; i < 3; i++) {
      await place([-2.6, 2.6, 0][i], [0, -12, -23][i]);
      await page.locator('[data-answer="0"]').waitFor();
      if (level === 0 && i === 0) {
        await page.locator('[data-answer="1"]').click();
        assert.match(await page.locator("#feedback").textContent(), /ลองใหม่/);
        assert.equal((await snap()).state.answered.length, 0);
      }
      await page
        .locator(`[data-answer="${stages[level].questions[i].answer}"]`)
        .click();
      assert.equal((await snap()).state.answered.length, level * 3 + i + 1);
      await page.locator("#leave").click();
    }
    await place(0, -3.9);
    await page.keyboard.press("e");
    await page.locator(".panel h2").waitFor();
    if ([0, 1, 2, 4].includes(level)) {
      if (level === 0)
        for (let i = 0; i < 3; i++) await page.locator("#drops").click();
      await page
        .locator("#slider")
        .fill(String({ 0: 90, 1: 12, 2: 20, 4: 15 }[level]));
      await page.locator("#slider").dispatchEvent("input");
      await page.locator("#apply").click();
    } else if (level === 3) {
      for (const choice of [1, 2, 0])
        await page.locator(`[data-choice="${choice}"]`).click();
    } else
      for (let i = 0; i < (level === 5 ? 4 : 3); i++)
        await page.locator(`[data-step="${i}"]`).click();
    await page.locator("#done").click();
    await place(0, -29);
    await page.keyboard.press("e");
    if (level < 6) {
      await page.locator("#next").click();
      assert.equal((await snap()).state.level, level + 1);
    } else await page.locator(".certificate").waitFor();
    console.log(
      `PASS stage ${level + 1}: three crystals, unique scores, minigame, portal`,
    );
  }
  assert.equal((await snap()).state.answered.length, 21);
  assert.ok((await snap()).state.completed);
  assert.match(await page.locator(".large-score").textContent(), /210/);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#download").click();
  assert.equal(
    (await downloadEvent).suggestedFilename(),
    "humidity-magic-world-results.csv",
  );
  console.log("PASS certificate and CSV download");
  await page.reload();
  await page.locator("#resume").click();
  await page.locator(".certificate").waitFor();
  console.log("PASS localStorage reload");
  await page.locator("#again").click();
  await page.locator("[name=name]").fill("เริ่มใหม่");
  await page.locator("[name=number]").fill("1");
  await page.locator("form .primary").click();
  await page.locator("#confirm").click();
  assert.equal((await snap()).state.answered.length, 0);
  assert.equal((await snap()).state.level, 0);
  console.log("PASS confirmed reset");
  await page.screenshot({ path: "/tmp/humidity-desktop.png" });
  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const mp = await mobile.newPage();
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto("http://localhost:5173");
  await mp.locator("[name=name]").fill("มือถือ ทดสอบ");
  await mp.locator("[name=number]").fill("2");
  await mp.locator("form .primary").click();
  assert.ok(await mp.locator("#joystick").isVisible());
  const r = await mp.locator("#joystick").boundingBox();
  await mp
    .locator("#joystick")
    .dispatchEvent("pointerdown", {
      pointerId: 1,
      clientX: r.x + r.width / 2,
      clientY: r.y + 5,
    });
  await mp.waitForFunction(
    () => window.__humidity.snapshot().position[2] < 8.8,
  );
  await mp.locator("#joystick").dispatchEvent("pointerup", { pointerId: 1 });
  await mp.locator("#jump").dispatchEvent("pointerdown");
  await mp.waitForFunction(
    () => window.__humidity.snapshot().position[1] > 0.1,
  );
  await mp.screenshot({ path: "/tmp/humidity-mobile.png" });
  console.log(
    "PASS mobile landscape layout, joystick and jump (emulated touch)",
  );
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log("PASS no browser JavaScript errors");
} finally {
  await browser.close();
}
