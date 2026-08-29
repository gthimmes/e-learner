import { test } from "node:test";
import assert from "node:assert/strict";
import { mockOutline, mockQuestions, mockTutorAnswer } from "../src/lib/ai-mock";
import { parseJsonLoose, validateOutline, validateQuestions } from "../src/lib/ai-types";

test("mock outline has the requested shape and a quiz per module", () => {
  const o = mockOutline("Data visualisation with charts", { modules: 3, lessonsPerModule: 4, audience: "analysts" });
  assert.equal(o.modules.length, 3);
  for (const m of o.modules) {
    assert.equal(m.lessons.length, 4);
    assert.equal(m.lessons.at(-1)!.type, "QUIZ");
    assert.ok(m.lessons[0]!.body.length > 200);
  }
  assert.ok(o.tags.includes("visualisation"));
  const v = validateOutline(o);
  assert.equal(v.title, "Data visualisation with charts");
});

test("mock questions are gradeable drafts", () => {
  const source = "Distractors should be plausible but wrong. A good quiz question checks exactly one idea. Pass marks around seventy percent are a sensible default for knowledge checks.";
  const qs = validateQuestions(mockQuestions(source, 6));
  assert.equal(qs.length, 6);
  assert.ok(qs.some((q) => q.type === "TRUE_FALSE"));
  assert.ok(qs.some((q) => q.type === "SHORT" && q.answerText));
  for (const q of qs) if (q.type !== "SHORT") assert.ok(q.choices!.some((c) => c.isCorrect));
});

test("parseJsonLoose tolerates prose and code fences; validators drop junk", () => {
  const parsed = parseJsonLoose<{ a: number }>('Sure! Here it is:\n```json\n{"a": 1}\n```\nLet me know.');
  assert.equal(parsed.a, 1);
  const qs = validateQuestions({ questions: [{ type: "SINGLE", prompt: "x", choices: [{ text: "only one" }] }, { type: "SHORT", prompt: "name it", answerText: "term" }, { prompt: "" }] });
  assert.equal(qs.length, 1);
  assert.equal(qs[0]!.type, "SHORT");
  assert.throws(() => validateOutline({ title: "no modules" }));
});

test("mock tutor stays grounded in the lesson", () => {
  const body = "Markdown lessons keep authoring fast. Sequential courses lock lessons until earlier ones are complete.";
  assert.match(mockTutorAnswer("Basics", body, "What does sequential mean?"), /lock lessons/);
  assert.match(mockTutorAnswer("Basics", body, "What is the capital of France?"), /does not cover/);
});
