// SW 킬스위치(app/layout.tsx)가 "새 배포인지" 판단하는 빌드 식별자. 빌드마다 하나로 고정돼야 한다 —
// 요청마다 바뀌면(예: Date.now()) 모든 로드가 새 배포로 보여 캐시 청소+새로고침이 끝없이 반복된다
// (2026-10-03 커밋 SHA 없는 로컬 운영 빌드에서 재현). SHA 가 없으면 next.config env 로 빌드 때 박힌 빌드 시각을 쓴다.
export function deployBuildId(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.NEXT_PUBLIC_BUILD_TIME ||
    "unknown-build"
  );
}
