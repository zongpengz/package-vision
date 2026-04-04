import assert from "node:assert/strict";
import { test } from "node:test";

import {
  determineDependencyStatus,
  findLatestVersionInCurrentMajor,
  hasMajorUpdate,
  getComparableDeclaredVersion,
  normalizeSemverRange
} from "../src/services/registryUtils";

test("determineDependencyStatus returns outdated when a caret range has a newer latest version", () => {
  assert.equal(determineDependencyStatus("^18.2.0", "18.3.1"), "outdated");
});

test("determineDependencyStatus returns outdated when latest escapes the declared range", () => {
  assert.equal(determineDependencyStatus("^18.2.0", "19.0.0"), "outdated");
});

test("determineDependencyStatus returns upToDate when the declared baseline already matches latest", () => {
  assert.equal(determineDependencyStatus("^18.3.1", "18.3.1"), "upToDate");
});

test("determineDependencyStatus returns unknown for non-semver declarations", () => {
  assert.equal(determineDependencyStatus("workspace:*", "19.0.0"), "unknown");
});

test("normalizeSemverRange returns undefined for unsupported ranges", () => {
  assert.equal(normalizeSemverRange("github:user/repo"), undefined);
});

test("getComparableDeclaredVersion extracts the baseline version from a saved range", () => {
  assert.equal(getComparableDeclaredVersion("^1.7.10"), "1.7.10");
  assert.equal(getComparableDeclaredVersion("~2.4.1"), "2.4.1");
  assert.equal(getComparableDeclaredVersion("3.0.0"), "3.0.0");
});

test("findLatestVersionInCurrentMajor returns the newest version within the current major", () => {
  assert.equal(
    findLatestVersionInCurrentMajor("^2.0.0", [
      "2.0.0",
      "2.1.0",
      "2.5.4",
      "3.0.0"
    ]),
    "2.5.4"
  );
});

test("hasMajorUpdate detects when the newest version jumps to a newer major", () => {
  assert.equal(hasMajorUpdate("^2.0.0", "30.0.0"), true);
  assert.equal(hasMajorUpdate("^2.0.0", "2.5.4"), false);
});
