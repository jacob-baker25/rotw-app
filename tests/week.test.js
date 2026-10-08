import test from "node:test";
import assert from "node:assert/strict";
import { currentWeek, votingWindow } from "../lib/constants.js";

test("the voting week closes at midnight Eastern during daylight time", () => {
  assert.deepEqual(currentWeek(new Date("2026-10-12T03:59:59Z")), {
    weekEnd: "2026-10-11",
    votingOpen: true,
  });
  assert.deepEqual(currentWeek(new Date("2026-10-12T04:00:00Z")), {
    weekEnd: "2026-10-18",
    votingOpen: false,
  });
});

test("the voting week closes at midnight Eastern during standard time", () => {
  assert.deepEqual(currentWeek(new Date("2026-11-09T04:59:59Z")), {
    weekEnd: "2026-11-08",
    votingOpen: true,
  });
  assert.deepEqual(currentWeek(new Date("2026-11-09T05:00:00Z")), {
    weekEnd: "2026-11-15",
    votingOpen: false,
  });
});

test("Saturday belongs to the Sunday week but voting has not opened", () => {
  assert.deepEqual(currentWeek(new Date("2026-10-10T16:00:00Z")), {
    weekEnd: "2026-10-11",
    votingOpen: false,
  });
});

test("Sunday voting opens and closes at Eastern midnight across spring daylight change", () => {
  assert.deepEqual(votingWindow("2026-03-08"), {
    votingStartsAt: "2026-03-08T05:00:00.000Z",
    votingEndsAt: "2026-03-09T04:00:00.000Z",
  });
});

test("Sunday voting opens and closes at Eastern midnight across fall daylight change", () => {
  assert.deepEqual(votingWindow("2026-11-01"), {
    votingStartsAt: "2026-11-01T04:00:00.000Z",
    votingEndsAt: "2026-11-02T05:00:00.000Z",
  });
});
