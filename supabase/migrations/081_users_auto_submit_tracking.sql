-- 081: 관리자 화면의 "자동 제출" 열이 읽는 두 시각
-- 2.3.0 까지는 제출 본문에 수동/자동 표식이 없어 서버가 자동 제출을 셀 수 없었다
-- (usage_stats.submission_source 가 전부 "cli"). CLI 2.3.1 이
--   · `submit --scheduled` 에 scheduled:true 를 실어 보내고 → last_scheduled_submit_at
--   · `autosubmit on/off` 결과를 /api/cli/autosubmit 으로 보고하고 → auto_sync_enabled(기존 열) + auto_sync_reported_at
-- 둘 다 null 이면 "미확인"(옛 CLI). service_role 전용 — 078 의 anon 컬럼 허용 목록에
-- 넣지 않았으므로 공개 라우트엔 노출되지 않는다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_scheduled_submit_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_sync_reported_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';
