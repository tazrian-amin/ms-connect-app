// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * When the "How was the demo?" dialog may show (lib/demo-feedback.ts). The module keeps its state
 * at module level, so each test loads it afresh.
 */

const DAY = 24 * 60 * 60 * 1000;
let feedback: typeof import("./demo-feedback");

beforeEach(async () => {
  vi.useFakeTimers({ now: 10 * DAY });
  localStorage.clear();
  vi.resetModules();
  vi.doMock("react", () => ({
    // Lets the test read what the dialog would show, without rendering.
    useSyncExternalStore: (_subscribe: unknown, get: () => string | null) => get(),
  }));
  feedback = await import("./demo-feedback");
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("react");
});

/** Which device the dialog is asking about right now, or null while it's closed. */
const read = () => feedback.useDemoFeedback();

/** A demo of `seconds`, ended with Exit demo, then the 1.5 s before the dialog shows. */
function demo(slug: string, seconds: number) {
  feedback.noteDemoStarted(slug);
  vi.advanceTimersByTime(seconds * 1000);
  feedback.offerDemoFeedback(slug);
  vi.advanceTimersByTime(1500);
  return read();
}

describe("demo feedback", () => {
  it("asks 1.5 s after a demo of at least 30 s", () => {
    feedback.noteDemoStarted("pump");
    vi.advanceTimersByTime(30_000);
    feedback.offerDemoFeedback("pump");
    vi.advanceTimersByTime(1499);
    expect(read()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(read()).toBe("pump");
  });

  it("doesn't ask after a shorter demo", () => {
    expect(demo("pump", 29)).toBeNull();
  });

  it("doesn't ask without a recorded start, e.g. a demo from an earlier page", () => {
    feedback.offerDemoFeedback("pump");
    vi.advanceTimersByTime(5000);
    expect(read()).toBeNull();
  });

  it("drops an offer that's cancelled before it shows", () => {
    feedback.noteDemoStarted("pump");
    vi.advanceTimersByTime(31_000);
    feedback.offerDemoFeedback("pump");
    feedback.cancelDemoFeedbackOffer();
    vi.advanceTimersByTime(5000);
    expect(read()).toBeNull();
  });

  it("asks once per device, ever", () => {
    expect(demo("pump", 31)).toBe("pump");
    feedback.closeDemoFeedback();
    vi.advanceTimersByTime(30 * DAY);
    expect(demo("pump", 31)).toBeNull();
  });

  it("waits 3 days before asking about another device", () => {
    expect(demo("pump", 31)).toBe("pump");
    feedback.closeDemoFeedback();

    vi.advanceTimersByTime(3 * DAY - 60_000);
    expect(demo("flow", 31)).toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(demo("flow", 31)).toBe("flow");
  });

  it("never asks again after \"Don't ask again\"", () => {
    expect(demo("pump", 31)).toBe("pump");
    feedback.closeDemoFeedback(true);
    expect(read()).toBeNull();
    vi.advanceTimersByTime(30 * DAY);
    expect(demo("flow", 31)).toBeNull();
    expect(JSON.parse(localStorage.getItem("ms-connect:demo-feedback")!)).toMatchObject({ optedOut: true });
  });

  it("starts over when the stored record is corrupt", () => {
    localStorage.setItem("ms-connect:demo-feedback", "{not json");
    expect(demo("pump", 31)).toBe("pump");
  });
});
