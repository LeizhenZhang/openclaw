import { describe, expect, it } from "vitest";
import { isAbortRequestText } from "./abort-primitives.js";
import { normalizeAbortTriggerText } from "./abort-trigger-text.js";

describe("normalizeAbortTriggerText", () => {
  it("drops only the punctuation run that ends the text", () => {
    expect(normalizeAbortTriggerText("Stop!!! now?!")).toBe("stop!!! now");
    expect(normalizeAbortTriggerText("停下来！")).toBe("停下来");
    expect(normalizeAbortTriggerText("wait…")).toBe("wait");
  });

  it("returns promptly when a long punctuation run does not end the text", () => {
    // The trailing-punctuation regex rescanned the run from each of its characters.
    const started = performance.now();
    expect(isAbortRequestText(`${"!".repeat(40_000)}a`)).toBe(false);
    expect(isAbortRequestText(`stop${"!".repeat(40_000)}`)).toBe(true);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
