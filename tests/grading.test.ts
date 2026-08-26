import { test } from "node:test";
import assert from "node:assert/strict";
import { grade, isCorrectResponse, responsesFromForm, type GradableQuestion } from "../src/lib/grading";

const single: GradableQuestion = {
  id: "q1",
  type: "SINGLE",
  points: 1,
  answerText: "",
  choices: [
    { id: "a", isCorrect: false },
    { id: "b", isCorrect: true },
  ],
};
const multi: GradableQuestion = {
  id: "q2",
  type: "MULTI",
  points: 2,
  answerText: "",
  choices: [
    { id: "x", isCorrect: true },
    { id: "y", isCorrect: true },
    { id: "z", isCorrect: false },
  ],
};
const short: GradableQuestion = { id: "q3", type: "SHORT", points: 1, answerText: "Paris\nparis, france", choices: [] };
const tf: GradableQuestion = {
  id: "q4",
  type: "TRUE_FALSE",
  points: 1,
  answerText: "",
  choices: [
    { id: "t", isCorrect: true },
    { id: "f", isCorrect: false },
  ],
};

test("single choice", () => {
  assert.equal(isCorrectResponse(single, "b"), true);
  assert.equal(isCorrectResponse(single, "a"), false);
  assert.equal(isCorrectResponse(single, undefined), false);
  assert.equal(isCorrectResponse(single, ["b"]), true);
});

test("multi select requires exact set", () => {
  assert.equal(isCorrectResponse(multi, ["x", "y"]), true);
  assert.equal(isCorrectResponse(multi, ["y", "x"]), true);
  assert.equal(isCorrectResponse(multi, ["x"]), false);
  assert.equal(isCorrectResponse(multi, ["x", "y", "z"]), false);
  assert.equal(isCorrectResponse(multi, "x"), false);
});

test("short answer is case/whitespace-insensitive and accepts alternates", () => {
  assert.equal(isCorrectResponse(short, "  PARIS "), true);
  assert.equal(isCorrectResponse(short, "Paris,  France"), true);
  assert.equal(isCorrectResponse(short, "London"), false);
  assert.equal(isCorrectResponse(short, ""), false);
});

test("true/false", () => {
  assert.equal(isCorrectResponse(tf, "t"), true);
  assert.equal(isCorrectResponse(tf, "f"), false);
});

test("grade weights by points and rounds", () => {
  const r = grade([single, multi, short, tf], { q1: "b", q2: ["x"], q3: "paris", q4: "t" });
  assert.equal(r.possible, 5);
  assert.equal(r.earned, 3);
  assert.equal(r.score, 60);
  assert.deepEqual(
    r.perQuestion.map((p) => p.correct),
    [true, false, true, true],
  );
});

test("empty quiz scores zero", () => {
  assert.equal(grade([], {}).score, 0);
});

test("responsesFromForm collects radios, checkboxes and text", () => {
  const fd = new FormData();
  fd.append("q_q1", "b");
  fd.append("q_q2", "x");
  fd.append("q_q2", "y");
  fd.append("q_q3", "Paris");
  const r = responsesFromForm(fd, ["q1", "q2", "q3", "q4"]);
  assert.deepEqual(r, { q1: "b", q2: ["x", "y"], q3: "Paris", q4: undefined });
});
