-- =====================================================
-- 049: Create Feedback Table
-- 사용자 버그 제보 및 피드백 수집
-- =====================================================

-- Feedback 테이블 생성
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- 피드백 내용
    type TEXT NOT NULL DEFAULT 'bug' CHECK (type IN ('bug', 'feature', 'general')),
    content TEXT NOT NULL,

    -- 컨텍스트 정보 (자동 수집)
    page_url TEXT,
    user_agent TEXT,

    -- 상태 관리
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    admin_note TEXT,

    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_feedback_status ON public.feedback(status);
CREATE INDEX idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX idx_feedback_user_id ON public.feedback(user_id);

-- RLS 활성화
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 로그인 사용자는 자신의 피드백만 생성 가능
CREATE POLICY "Users can insert own feedback"
    ON public.feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt() ->> 'sub')
    );

-- RLS 정책: 자신의 피드백만 조회 가능
CREATE POLICY "Users can view own feedback"
    ON public.feedback
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT id FROM public.users WHERE clerk_id = auth.jwt() ->> 'sub')
    );

-- RLS 정책: Admin은 모든 피드백 조회/수정 가능
CREATE POLICY "Admins can manage all feedback"
    ON public.feedback
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE clerk_id = auth.jwt() ->> 'sub'
            AND is_admin = true
        )
    );

-- Service role은 전체 접근 가능
CREATE POLICY "Service role full access to feedback"
    ON public.feedback
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_feedback_updated_at
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();

-- 코멘트
COMMENT ON TABLE public.feedback IS '사용자 버그 제보 및 피드백';
COMMENT ON COLUMN public.feedback.type IS '피드백 유형: bug, feature, general';
COMMENT ON COLUMN public.feedback.status IS '처리 상태: new, in_progress, resolved, closed';
