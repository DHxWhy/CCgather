-- ═══════════════════════════════════════════════════════════════════════════
-- 063_usage_stats_submitted_at_index.sql
-- usage_stats(submitted_at) 인덱스 — time-window 조회 가속 (Pluto 패널 권장)
--
-- 문제: "최근 N일 제출" 류 쿼리가 submitted_at 인덱스 부재로 Sequential Scan
--   (전체 행 훑기). 데이터 증가 시 WAU/MAU RPC·submit-logs·funnels·notifications
--   ·cli/submit 모두 느려짐.
-- 해결: submitted_at DESC btree 인덱스 → 시간 구간 Index Scan 으로 직행.
--
-- ⚠️ 적용 완료: 2026-05-29 Supabase MCP execute_sql 로 직접 실행됨 (사용자 지시).
--   본 파일은 기록용. CONCURRENTLY 미사용 — usage_stats 소규모(~1154행)라 lock 무의미.
--   (대규모 테이블이라면 Dashboard 에서 CREATE INDEX CONCURRENTLY 권장)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_usage_stats_submitted_at
  ON public.usage_stats (submitted_at DESC);

NOTIFY pgrst, 'reload schema';
