export type SearchProvider = "brave" | "tavily";

// Conservative upper bounds, not a promise of provider free-tier eligibility.
// Activation requires verifying billing cycle, credits and no-overage settings.
const MAX_MONTHLY_UNITS: Record<SearchProvider, number> = {
  brave: 1000,
  tavily: 1000,
};

export interface SearchBudgetReservation {
  used: number;
  remaining: number;
}

/**
 * Reserve before each outbound attempt. Failed requests still consume the reservation.
 * One atomic D1 write: concurrent callers cannot exceed the configured monthly cap.
 * DB errors propagate; callers must fail closed without making a provider request.
 */
export async function reserveSearchBudget(
  db: D1Database,
  provider: SearchProvider,
  monthlyLimit: number,
  units = 1,
  now = new Date(),
): Promise<SearchBudgetReservation | null> {
  const ceiling = MAX_MONTHLY_UNITS[provider];
  if (
    !Number.isSafeInteger(ceiling) ||
    !Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1 || monthlyLimit > ceiling ||
    !Number.isSafeInteger(units) || units < 1 || units > monthlyLimit ||
    !Number.isFinite(now.getTime())
  ) return null;

  const month = now.toISOString().slice(0, 7);
  const row = await db.prepare(
    `INSERT INTO search_budgets (provider, month_utc, used)
     VALUES (?1, ?2, ?3)
     ON CONFLICT(provider, month_utc) DO UPDATE SET used = used + excluded.used
     WHERE used <= ?4 - excluded.used
     RETURNING used`,
  ).bind(provider, month, units, monthlyLimit).first<{ used: number }>();

  return row ? { used: row.used, remaining: monthlyLimit - row.used } : null;
}
