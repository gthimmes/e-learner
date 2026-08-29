import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs, escapeIcs, foldLine, icsDate } from "../src/lib/ics";

test("icsDate is UTC basic format", () => {
  assert.equal(icsDate(new Date("2026-09-01T15:30:00Z")), "20260901T153000Z");
});

test("escapes reserved characters", () => {
  assert.equal(escapeIcs("a, b; c\\d\nnext"), "a\\, b\\; c\\\\d\\nnext");
});

test("folds long lines at 75 octets", () => {
  const long = "DESCRIPTION:" + "x".repeat(200);
  const folded = foldLine(long);
  for (const l of folded.split("\r\n")) assert.ok(Buffer.byteLength(l) <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), long);
});

test("builds a valid VCALENDAR", () => {
  const ics = buildIcs(
    [
      {
        uid: "s1@e-learner",
        start: new Date("2026-09-01T15:00:00Z"),
        end: new Date("2026-09-01T16:00:00Z"),
        summary: "Office hours: SQL, part 1",
        description: "Bring questions.\nSee you there",
        url: "https://meet.example.com/abc",
        organizer: { name: "Ian Instructor", email: "instructor@example.com" },
      },
    ],
    { now: new Date("2026-08-28T00:00:00Z"), method: "REQUEST" },
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.match(ics, /METHOD:REQUEST/);
  assert.match(ics, /UID:s1@e-learner/);
  assert.match(ics, /DTSTART:20260901T150000Z/);
  assert.match(ics, /SUMMARY:Office hours: SQL\\, part 1/);
  assert.match(ics, /DESCRIPTION:Bring questions\.\\nSee you there/);
  assert.match(ics, /ORGANIZER;CN=Ian Instructor:mailto:instructor@example\.com/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
