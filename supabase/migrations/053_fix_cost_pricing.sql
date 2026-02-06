-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 053: Fix cost pricing based on LiteLLM actual prices
--
-- Previous pricing was incorrect:
--   Opus: $15/$75 (Claude 3 Opus price, not Claude Opus 4)
--   Haiku: $0.25/$1.25 (Claude 3 Haiku price, not Claude 4 Haiku)
--
-- Corrected pricing (LiteLLM / official Claude 4 pricing):
--   Opus 4:   $5/$25 input/output per 1M tokens
--   Sonnet 4: $3/$15 input/output per 1M tokens
--   Haiku:    $1/$5 input/output per 1M tokens
--
-- Cache token pricing:
--   cache_write = input_price * 1.25
--   cache_read  = input_price * 0.1
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Recalculate usage_stats.cost_usd based on primary_model
UPDATE usage_stats SET cost_usd = ROUND((
  CASE
    WHEN primary_model ILIKE '%opus%' THEN
      (COALESCE(input_tokens, 0) * 5.0 / 1000000) +
      (COALESCE(output_tokens, 0) * 25.0 / 1000000) +
      (COALESCE(cache_write_tokens, 0) * 6.25 / 1000000) +
      (COALESCE(cache_read_tokens, 0) * 0.5 / 1000000)
    WHEN primary_model ILIKE '%haiku%' THEN
      (COALESCE(input_tokens, 0) * 1.0 / 1000000) +
      (COALESCE(output_tokens, 0) * 5.0 / 1000000) +
      (COALESCE(cache_write_tokens, 0) * 1.25 / 1000000) +
      (COALESCE(cache_read_tokens, 0) * 0.1 / 1000000)
    ELSE -- sonnet (default)
      (COALESCE(input_tokens, 0) * 3.0 / 1000000) +
      (COALESCE(output_tokens, 0) * 15.0 / 1000000) +
      (COALESCE(cache_write_tokens, 0) * 3.75 / 1000000) +
      (COALESCE(cache_read_tokens, 0) * 0.3 / 1000000)
  END
)::numeric, 2);

-- Step 2: Recalculate users.total_cost from corrected usage_stats
UPDATE users u SET total_cost = sub.new_cost
FROM (
  SELECT user_id, ROUND(SUM(cost_usd)::numeric, 2) as new_cost
  FROM usage_stats
  GROUP BY user_id
) sub
WHERE u.id = sub.user_id;
