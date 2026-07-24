-- =====================================================
-- 075_lock_season_rpcs.sql
-- 074 RPC 를 service_role 전용으로 잠금 (anon/PUBLIC 실행 차단)
-- =====================================================
-- ⚠️ 근본 원인: CREATE FUNCTION 은 항상 EXECUTE 를 PUBLIC 에 grant 한다.
--    REVOKE ... FROM anon, authenticated 는 PUBLIC grant 를 건드리지 않아
--    anon(=PUBLIC 멤버)이 계속 실행 가능했다. 그래서 FROM PUBLIC 까지 REVOKE
--    하고 service_role 에만 명시적으로 GRANT 한다.
--    검증: anon 으로 /rest/v1/rpc/<fn> 호출 시 401/404 (200 이면 실패).
--    이 함수들은 전부 서버(createServiceClient=service_role)에서만 호출된다.
-- =====================================================

REVOKE ALL ON FUNCTION public.current_season_start() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_season_start() TO service_role;

REVOKE ALL ON FUNCTION public.season_finalized(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.season_finalized(date) TO service_role;

REVOKE ALL ON FUNCTION public.get_season_board(date, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_season_board(date, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_season_position(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_season_position(uuid, date) TO service_role;

REVOKE ALL ON FUNCTION public.get_month_race() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_month_race() TO service_role;

REVOKE ALL ON FUNCTION public.get_month_country_race() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_month_country_race() TO service_role;

REVOKE ALL ON FUNCTION public.get_season_categories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_season_categories() TO service_role;

REVOKE ALL ON FUNCTION public.snapshot_monthly_hof(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_monthly_hof(date) TO service_role;

NOTIFY pgrst, 'reload schema';
