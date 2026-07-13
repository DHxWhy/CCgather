-- =====================================================
-- 071_recent_syncs_username.sql
-- get_recent_syncs 에 username 추가 (Live syncs 닉네임+딥링크)
-- =====================================================
-- 반환 컬럼 변경이라 CREATE OR REPLACE 불가 → DROP 후 재생성.
-- username 은 리더보드에 이미 공개된 정보. REVOKE 재동봉
-- (재생성 시 anon/authenticated GRANT 재발동 함정).
-- =====================================================

DROP FUNCTION IF EXISTS public.get_recent_syncs();

CREATE FUNCTION public.get_recent_syncs()
RETURNS TABLE (username TEXT, country_code TEXT, synced_at TIMESTAMPTZ)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT sub.username::TEXT, sub.country_code::TEXT, sub.synced_at
  FROM (
    SELECT u.username, u.country_code, MAX(us.submitted_at) AS synced_at
    FROM public.usage_stats us
    JOIN public.users u ON u.id = us.user_id
    WHERE u.deleted_at IS NULL AND u.shadow_banned = false
      AND u.country_code IS NOT NULL AND us.submitted_at IS NOT NULL
    GROUP BY u.id, u.username, u.country_code
  ) sub
  ORDER BY sub.synced_at DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.get_recent_syncs() FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
