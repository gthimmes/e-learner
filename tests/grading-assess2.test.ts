import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptDeadline, drawQuestionIds, grade, isExpired, rescore, type GradableQuestion } from "../src/lib/grading";

const single: GradableQuestion = { id: "q1", type: "SINGLE", points: 1, answerText: "", choices: [{ id: "a", isCorrect: true }, { id: "b", isCorrect: false }] };
const essay: GradableQuestion = { id: "e1", type: "ESSAY", points: 3, answerText: "", choices: [] };

test("essay answers are pending, count toward possible but not earned", () => {
  const r = grade([single, essay], { q1: "a", e1: "Because obvious distractors do not discriminate." });
  assert.equal(r.pending, 1);
  assert.equal(r.earned, 1);
  assert.equal(r.possible, 4);
  assert.equal(r.score, 25);
  assert.equal(r.perQuestion[1]!.pending, true);
  assert.equal(r.perQuestion[1]!.correct, false);
});

test("a blank essay is not pending — it is simply wrong", () => {
  const r = grade([essay], { e1: "   " });
  assert.equal(r.pending, 0);
  assert.equal(r.score, 0);
});

test("rescore after grading essays", () => {
  const before = rescore([
    { type: "SINGLE", points: 1, correct: true, pointsAwarded: null },
    { type: "ESSAY", points: 3, correct: false, pointsAwarded: null },
  ]);
  assert.deepEqual(before, { score: 25, earned: 1, possible: 4, pending: 1 });
  const after = rescore([
    { type: "SINGLE", points: 1, correct: true, pointsAwarded: null },
    { type: "ESSAY", points: 3, correct: true, pointsAwarded: 2 },
  ]);
  assert.deepEqual(after, { score: 75, earned: 3, possible: 4, pending: 0 });
  // Awarded points are clamped to the question maximum.
  assert.equal(rescore([{ type: "ESSAY", points: 3, correct: true, pointsAwarded: 99 }]).score, 100);
});

test("drawQuestionIds keeps bank order and respects count", () => {
  const ids = ["a", "b", "c", "d", "e"];
  assert.deepEqual(drawQuestionIds(ids, 0), ids);
  assert.deepEqual(drawQuestionIds(ids, 9), ids);
  const seq = [0.9, 0.1, 0.5, 0.3];
  let i = 0;
  const drawn = drawQuestionIds(ids, 3, () => seq[i++ % seq.length]!);
  assert.equal(drawn.length, 3);
  assert.deepEqual(drawn, ids.filter((x) => drawn.includes(x))); // original relative order
  assert.equal(new Set(drawn).size, 3);
});

test("deadline and expiry with grace", () => {
  const start = new Date("2026-08-28T10:00:00Z");
  assert.equal(attemptDeadline(start, 0), null);
  const d = attemptDeadline(start, 10)!;
  assert.equal(d.toISOString(), "2026-08-28T10:10:00.000Z");
  assert.equal(isExpired(null), false);
  assert.equal(isExpired(d, new Date("2026-08-28T10:10:05Z")), false); // inside grace
  assert.equal(isExpired(d, new Date("2026-08-28T10:10:30Z")), true);
});
