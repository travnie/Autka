export type SearchProvider = "brave" | "tavily";

export interface SearchBudgetReservation {
  month: string;
  used: number;
  remaining: number;
}

export function utcBudgetMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

/**
 * Reserve before each outbound attempt. Failures consume reservations.
 * Canonical D1 cap, shared by all deployments. Missing cap = disabled.
 * DB errors propagate. Never send a request after a failed reservation.
 */
export async function reserveSearchBudget(
  db: D1Database,
  provider: SearchProvider,
  units = 1,
  now = new Date(),
): Promise<SearchBudgetReservation | null> {
  if (!Number.isSafeInteger(units) || units < 1 || units > 1000 ||
      !Number.isFinite(now.getTime())) return null;

  const month = utcBudgetMonth(now);
  const row = await db.prepare(
    `INSERT INTO search_budgets (provider, month_utc, used)
     SELECT provider, ?2, ?3 FROM search_provider_limits
     WHERE provider = ?1 AND monthly_limit >= ?3
     ON CONFLICT(provider, month_utc) DO UPDATE SET used = used + excluded.used
     WHERE used <= (SELECT monthly_limit FROM search_provider_limits WHERE provider = ?1) - excluded.used
     RETURNING used, (SELECT monthly_limit FROM search_provider_limits WHERE provider = ?1) AS cap`,
  ).bind(provider, month, units).first<{ used: number; cap: number }>();

  return row ? { month, used: row.used, remaining: row.cap - row.used } : null;
}

/** Recheck immediately before dispatch; fail closed on rollover. */
export function isCurrentReservation(reservation: SearchBudgetReservation, now = new Date()): boolean {
  return Number.isFinite(now.getTime()) && reservation.month === utcBudgetMonth(now);
}
