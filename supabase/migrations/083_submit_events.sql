-- =====================================================
-- 083_submit_events.sql
-- CLI 제출 요청 한 건당 한 행 — 시간당 제한을 요청 수로 센다
-- =====================================================
-- 지금까지 제한은 usage_stats.submitted_at 의 최근 한 시간 고유값 수로 셌다. 행마다 시각을
-- 따로 찍어 제출 한 번이 여러 번으로 보였고(2026-11-18 실측: 기기별 마지막 제출 63건 중
-- 56건이 다음 제출을 한 시간 막음), 시각을 요청당 하나로 맞추면 다음 제출이 같은 행을
-- 덮어써 거꾸로 늘 1번으로 보인다. 거절·오류로 끝난 요청은 행을 남기지 않아 지문 조회와
-- 저장을 횟수 제한 없이 되풀이할 수도 있었다.
--
-- outcome: 'attempt'(제한을 통과한 요청마다 하나) · 'accepted'(끝까지 받은 제출) ·
--          'duplicate_session'(다른 계정 지문이 섞여 거절). 제한은 최근 한 시간의
--          accepted 2건 · attempt 10건으로 판정한다(lib/services/submit-rate-limit.ts).
-- id 는 순번이다 — 무작위 키 색인은 표가 커질수록 쓰기가 느려진다(submitted_sessions 사례).
-- service_role 전용: RLS 정책도 권한도 anon · authenticated 에는 주지 않는다.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.submit_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  device_id VARCHAR(16),
  cli_version TEXT,
  submission_source TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submit_events_user_created
  ON public.submit_events (user_id, created_at DESC);

ALTER TABLE public.submit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages submit_events" ON public.submit_events;
CREATE POLICY "Service role manages submit_events"
  ON public.submit_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.submit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.submit_events TO service_role;

COMMENT ON TABLE public.submit_events IS 'CLI 제출 요청 기록 — 시간당 제한 판정과 거절 이력';
COMMENT ON COLUMN public.submit_events.outcome IS 'attempt | accepted | duplicate_session';

NOTIFY pgrst, 'reload schema';
