-- =====================================================
-- 078_users_anon_column_lock.sql
-- public.users 의 anon/authenticated 권한 최소화 (P0 보안)
-- =====================================================
-- ⚠️ 실측 발견(2026-07-25, prod anon 키): anon 이 users 의 전 컬럼을 읽어
--    api_key(=CLI Bearer 토큰) 90건·email·clerk_id 가 노출됐고, UPDATE/DELETE
--    권한(HTTP 204)까지 보유했다. RLS 는 행만 거르고 컬럼은 못 거른다.
-- 근본: CREATE 시 자동 부여되는 테이블수준 GRANT SELECT/UPDATE/DELETE 를
--    아무도 회수하지 않음. 컬럼수준 제한은 테이블 GRANT 를 먼저 REVOKE 해야 함.
-- 전제(선행 배포 완료): 특권 조회/쓰기(관리자 인증·CLI 인증/싱크)는 전부
--    service_role 로 전환됨. 남은 anon users 읽기는 공개 라우트 7개(아래 컬럼만).
--    ⚠️ 이 목록은 그 7개 라우트의 select+where+order 컬럼 합집합이다. 라우트가
--    새 컬럼을 읽으면 여기에 추가해야 500 이 안 난다.
-- service_role 은 Supabase 기본 GRANT 를 별도 보유 → 이 REVOKE 에 영향 없음.
-- 검증: anon GET /rest/v1/users?select=api_key → 401(42501), select=id → 200.
-- =====================================================

REVOKE ALL ON public.users FROM anon, authenticated;

GRANT SELECT (
  id,
  username,
  display_name,
  display_avatar_url,
  country_code,
  current_level,
  global_rank,
  country_rank,
  total_tokens,
  total_cost,
  total_sessions,
  ccplan,
  has_opus_usage,
  social_links,
  onboarding_completed,
  shadow_banned,
  deleted_at,
  created_at
) ON public.users TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
