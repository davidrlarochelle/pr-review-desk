import { describe, expect, it } from "vitest";
import { parseStream, statsFromEvent } from "../services/run-log";

describe("statsFromEvent", () => {
  it("reads the numbers off a result event", () => {
    const stats = statsFromEvent({
      type: "result",
      subtype: "success",
      session_id: "s-1",
      num_turns: 2,
      duration_ms: 41000,
      total_cost_usd: 0.183,
      usage: { input_tokens: 12, output_tokens: 3400, cache_read_input_tokens: 900, cache_creation_input_tokens: 21000 },
    });
    expect(stats).toEqual({
      sessionId: "s-1",
      numTurns: 2,
      durationMs: 41000,
      costUsd: 0.183,
      inputTokens: 12,
      outputTokens: 3400,
      cacheReadTokens: 900,
      cacheCreationTokens: 21000,
    });
  });

  it("takes only the session id from init, and nothing from other events", () => {
    expect(statsFromEvent({ type: "system", subtype: "init", session_id: "s-2", model: "x" })).toEqual({ sessionId: "s-2" });
    expect(statsFromEvent({ type: "assistant", message: {} })).toEqual({});
    expect(statsFromEvent("not an object")).toEqual({});
  });

  it("ignores fields of the wrong type", () => {
    expect(statsFromEvent({ type: "result", num_turns: "2", usage: null })).toMatchObject({ numTurns: undefined, inputTokens: undefined });
  });
});

describe("parseStream", () => {
  it("keeps every line, parsed when it is JSON and as text when it is not", () => {
    expect(parseStream('{"type":"system"}\n\nnot json\n{"type":"result"}\n')).toEqual([{ type: "system" }, "not json", { type: "result" }]);
  });
});
