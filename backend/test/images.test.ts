import { describe, expect, it } from "vitest";
import { readBodyUpTo } from "../src/lib/body";

function stream(...chunks: number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  });
}

describe("readBodyUpTo", () => {
  it("accepts a body exactly at the limit", async () => {
    const body = await readBodyUpTo(stream([1, 2], [3, 4, 5]), 5);
    expect(body).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
  });

  it("rejects a chunked body once it crosses the limit", async () => {
    const body = stream([1, 2, 3], [4, 5, 6]);
    expect(await readBodyUpTo(body, 5)).toBeNull();
    expect(body.locked).toBe(false);
  });
  it("releases the reader after an already-aborted read", async () => {
    const body = stream([1]);
    const controller = new AbortController();
    controller.abort();
    await expect(readBodyUpTo(body, 5, controller.signal)).rejects.toThrow("body_read_aborted");
    expect(body.locked).toBe(false);
  });
});
