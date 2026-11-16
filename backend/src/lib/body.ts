/** Read a bounded body. Concatenation temporarily holds up to 2 × maxBytes, plus one input chunk. */
export async function readBodyUpTo(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });

  try {
    if (signal?.aborted) {
      cancel();
      throw new Error("body_read_aborted");
    }
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw new Error("body_read_aborted");
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", cancel);
    reader.releaseLock();
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
