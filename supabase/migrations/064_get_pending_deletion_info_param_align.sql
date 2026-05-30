-- 064: get_pending_deletion_info 파라미터명 정합 (target_clerk_id → p_clerk_id)
--
-- 배경: 라이브 DB 는 이미 p_clerk_id 로 운영 중이었으나(마이그레이션 밖 drift),
-- 기록(033/042/057)·코드·타입은 target_clerk_id 였음. 이 불일치로 PostgREST 가
-- PGRST202 를 던져 /api/auth/recovery-check · /api/auth/fresh-start 가 항상 500.
-- 코드/타입을 p_clerk_id 로 맞추고(이 코드베이스의 p_ 파라미터 컨벤션과 일치),
-- 이 마이그레이션으로 함수 정의를 기록·정합화한다.
--
-- 주의: 함수 본문은 라이브와 100% 동일(표준 7일 삭제확인). prod 는 이미 이 정의를
-- 갖고 있으므로 별도 실행 불필요 — fresh rebuild 시 정합을 보장하기 위한 기록.
-- CREATE OR REPLACE 로는 파라미터명을 못 바꾸므로 DROP 후 재생성(멱등).

DROP FUNCTION IF EXISTS public.get_pending_deletion_info(text);

CREATE OR REPLACE FUNCTION public.get_pending_deletion_info(p_clerk_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_record record;
  v_days_remaining integer;
BEGIN
  SELECT * INTO v_user_record
  FROM users
  WHERE clerk_id = p_clerk_id AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('pending', false);
  END IF;

  v_days_remaining := GREATEST(0, 7 - EXTRACT(DAY FROM NOW() - v_user_record.deleted_at)::integer);

  RETURN jsonb_build_object(
    'pending', true,
    'deleted_at', v_user_record.deleted_at,
    'days_remaining', v_days_remaining,
    'username', v_user_record.username,
    'display_name', v_user_record.display_name
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';
