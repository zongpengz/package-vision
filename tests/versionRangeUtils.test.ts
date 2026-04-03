import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectSavedVersionRangeStyle,
  formatVersionRange,
  normalizeConfiguredVersionRangeStyle,
  resolveVersionRangeStyle
} from "../src/services/versionRangeUtils";

test("normalizeConfiguredVersionRangeStyle falls back to preserve", () => {
  assert.equal(normalizeConfiguredVersionRangeStyle("unexpected"), "preserve");
});

test("detectSavedVersionRangeStyle recognizes caret, tilde, and exact", () => {
  assert.equal(detectSavedVersionRangeStyle("^1.2.3"), "caret");
  assert.equal(detectSavedVersionRangeStyle("~1.2.3"), "tilde");
  assert.equal(detectSavedVersionRangeStyle("1.2.3"), "exact");
});

test("formatVersionRange writes the expected prefix", () => {
  assert.equal(formatVersionRange("2.0.0", "caret"), "^2.0.0");
  assert.equal(formatVersionRange("2.0.0", "tilde"), "~2.0.0");
  assert.equal(formatVersionRange("2.0.0", "exact"), "2.0.0");
});

test("resolveVersionRangeStyle preserves the current style when possible", () => {
  assert.deepEqual(resolveVersionRangeStyle("preserve", "~1.0.0", "2.0.0"), {
    versionRange: "~2.0.0",
    savedStyle: "tilde",
    usedFallbackStyle: false
  });
});

test("resolveVersionRangeStyle falls back to caret for complex preserved ranges", () => {
  assert.deepEqual(resolveVersionRangeStyle("preserve", "1.x", "2.0.0"), {
    versionRange: "^2.0.0",
    savedStyle: "caret",
    usedFallbackStyle: true
  });
});

test("resolveVersionRangeStyle applies an explicit exact preference", () => {
  assert.deepEqual(resolveVersionRangeStyle("exact", "^1.0.0", "2.0.0"), {
    versionRange: "2.0.0",
    savedStyle: "exact",
    usedFallbackStyle: false
  });
});
