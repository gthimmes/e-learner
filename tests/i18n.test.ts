import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTS, LOCALES, negotiateLocale, translate } from "../src/lib/i18n-dict";

test("every locale covers every English key", () => {
  const keys = Object.keys(DICTS.en);
  for (const l of LOCALES) {
    const missing = keys.filter((k) => !DICTS[l][k]);
    assert.deepEqual(missing, [], `${l} is missing ${missing.join(", ")}`);
  }
});

test("translate interpolates and falls back", () => {
  assert.equal(translate("es", "learn.welcome", { name: "Ana" }), "Hola de nuevo, Ana.");
  assert.equal(translate("fr", "nav.unread", { n: 3 }), "3 notifications non lues");
  assert.equal(translate("es", "does.not.exist"), "does.not.exist");
  assert.equal(translate("en", "learn.welcome"), "Welcome back, {name}.");
});

test("Accept-Language negotiation", () => {
  assert.equal(negotiateLocale("fr-CA,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(negotiateLocale("de-DE,de;q=0.9,es;q=0.5"), "es");
  assert.equal(negotiateLocale("de"), "en");
  assert.equal(negotiateLocale(null), "en");
});
