-- Fixed-window attempt counters, keyed e.g. "send:<invite token>". Cloudflare's native rate-limit
-- binding only offers 10s/60s windows, so hourly limits live here.
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL  -- ms since epoch
);
