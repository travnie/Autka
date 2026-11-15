-- Canonical operator-set caps. Missing/zero = disabled; no per-deployment cap.
CREATE TABLE IF NOT EXISTS search_provider_limits (
  provider TEXT NOT NULL PRIMARY KEY CHECK (provider IN ('brave', 'tavily')),
  monthly_limit INTEGER NOT NULL CHECK (
    typeof(monthly_limit) = 'integer' AND monthly_limit BETWEEN 0 AND 1000
  )
);

-- Global provider quota reservations; no query, client or listing data.
CREATE TABLE IF NOT EXISTS search_budgets (
  provider TEXT NOT NULL CHECK (provider IN ('brave', 'tavily')),
  month_utc TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  PRIMARY KEY (provider, month_utc)
);
