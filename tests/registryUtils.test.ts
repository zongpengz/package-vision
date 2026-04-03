import assert from "node:assert/strict";
import { test } from "node:test";

import {
  determineDependencyStatus,
  normalizeSemverRange
} from "../src/services/registryUtils";

test("determineDependencyStatus returns upToDate when latest satisfies the declared range", () => {
  assert.equal(determineDependencyStatus("^18.2.0", "18.3.1"), "upToDate");
});

test("determineDependencyStatus returns outdated when latest escapes the declared range", () => {
  assert.equal(determineDependencyStatus("^18.2.0", "19.0.0"), "outdated");
});

test("determineDependencyStatus returns unknown for non-semver declarations", () => {
  assert.equal(determineDependencyStatus("workspace:*", "19.0.0"), "unknown");
});

test("normalizeSemverRange returns undefined for unsupported ranges", () => {
  assert.equal(normalizeSemverRange("github:user/repo"), undefined);
});
