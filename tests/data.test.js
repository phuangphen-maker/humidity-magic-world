import test from "node:test";
import assert from "node:assert/strict";
import { stages, fresh, score, answer, validSave } from "../src/data.js";
test("seven stages each have three valid four-choice questions and scientific explanations", () => {
  assert.equal(stages.length, 7);
  for (const stage of stages) {
    assert.equal(stage.questions.length, 3);
    for (const q of stage.questions) {
      assert.equal(q.options.length, 4);
      assert.ok(q.answer >= 0 && q.answer < 4);
      assert.ok(q.explain.length > 30);
    }
  }
});
test("all 21 crystals give exactly 210 points, retries never duplicate points", () => {
  const s = fresh({ name: "ทดสอบ", room: "ม.1/1", number: "1" });
  for (let i = 0; i < 21; i++) {
    answer(s, i);
    answer(s, i);
  }
  assert.equal(score(s), 210);
  assert.equal(s.answered.length, 21);
  assert.ok(validSave(JSON.parse(JSON.stringify(s))));
});
test("invalid or corrupted progress is rejected", () => {
  assert.ok(!validSave(null));
  const s = fresh({ name: "ทดสอบ" });
  s.level = 7;
  assert.ok(!validSave(s));
  s.level = 0;
  s.answered = [0, 0];
  assert.ok(!validSave(s));
});
