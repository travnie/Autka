-- Global provider quota reservations; no query, client or listing data.
CREATE TABLE IF NOT EXISTS search_budgets (
  provider TEXT NOT NULL CHECK (provider IN ('brave', 'tavily')),
  month_utc TEXT NOT NULL,
  used INTEGER NOT NULL CHECK (used >= 0),
  PRIMARY KEY (provider, month_utc)
);
