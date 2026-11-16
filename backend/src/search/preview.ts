export interface IndexedPreview {
  title: string;
  url: string;
  marketplace: "otomoto" | "olx";
  provider: "brave" | "tavily";
  snippet: string;
}

export const PL_TARGETS = [
  { scope: "otomoto.pl/osobowe/oferta/", marketplace: "otomoto", path: /^\/osobowe\/oferta\/[^/]+-ID([a-zA-Z0-9]+)\.html$/ },
  { scope: "olx.pl/d/oferta/", marketplace: "olx", path: /^\/d\/oferta\/[^/]+-CID5-ID([a-zA-Z0-9]+)\.html$/ },
] as const;

export const MAX_RESULTS = 20;

export function boundedTerms(input: string): string {
  const words = input.slice(0, 256).match(/[\p{L}\p{N}]+/gu) ?? [];
  const accepted: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const lower = word.toLowerCase();
    if (["and", "or", "not"].includes(lower) || seen.has(lower)) continue;
    if ([...accepted, word].join(" ").length > 40) continue;
    accepted.push(word);
    seen.add(lower);
    if (accepted.length === 6) break;
  }
  return accepted.join(" ");
}

export function normalizedKey(input: string): string | null {
  const key = input.trim();
  return key && /^[\x21-\x7e]+$/.test(key) ? key : null;
}

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  // Collapse whitespace without allocating a copy of the entire input.
  const output: string[] = [];
  let space = false;
  for (const char of value) {
    const point = char.codePointAt(0) ?? 0;
    if (/\s/u.test(char) || point < 32 || point === 127) {
      space = output.length > 0;
      continue;
    }
    if (space && output.length + 1 >= max) break;
    if (space) output.push(" ");
    output.push(/[\uD800-\uDFFF]/u.test(char) ? "\uFFFD" : char);
    space = false;
    if (output.length >= max) break;
  }
  return output.join("");
}

function listing(raw: unknown) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  // Origin excludes URL userinfo; require it to start the serialized URL.
  if (url.protocol !== "https:" || url.port || !url.href.startsWith(url.origin + "/")) return null;
  const hostname = url.hostname.replace(/^www\./, "");
  const target = PL_TARGETS.find(({ scope }) => scope.split("/")[0] === hostname);
  const id = target?.path.exec(url.pathname)?.[1];
  if (!target || !id) return null;
  url.hash = "";
  return { url: url.href, marketplace: target.marketplace, id: `${target.marketplace}:${id}` };
}

export function decodePlRows(
  rows: unknown[],
  provider: IndexedPreview["provider"],
  getSnippet: (row: Record<string, unknown>) => unknown,
): IndexedPreview[] {
  const seen = new Set<string>();
  const previews: IndexedPreview[] = [];
  for (const item of rows.slice(0, MAX_RESULTS)) {
    const row = record(item);
    if (!row) continue;
    const match = listing(row.url);
    const title = text(row.title, 200);
    if (!match || !title || seen.has(match.id)) continue;
    seen.add(match.id);
    previews.push({
      title,
      url: match.url,
      marketplace: match.marketplace,
      provider,
      snippet: text(getSnippet(row), 500),
    });
  }
  return previews;
}
