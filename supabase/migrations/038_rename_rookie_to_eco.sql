-- ════════════════════════════════════════════════════════════════════════════════
-- Rename level_league enum value: rookie → eco
-- ════════════════════════════════════════════════════════════════════════════════
--
-- Rationale:
-- "Rookie" implies beginner/novice, but users with low token usage may be:
-- - Efficient developers who use tokens wisely
-- - Economical users who maximize value
-- - Specialists who use Claude for specific tasks only
--
-- "Eco" represents:
-- - Economic (cost-efficient usage)
-- - Ecological (resource-conscious, sustainable)
-- - Positive framing instead of "beginner" stigma
-- ════════════════════════════════════════════════════════════════════════════════

ALTER TYPE level_league_type RENAME VALUE 'rookie' TO 'eco';
