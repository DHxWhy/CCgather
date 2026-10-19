// 브라우저 기본 <select> 의 펼침 목록은 select 요소의 color-scheme 과 option 의 색을 따른다.
// 관리자 화면은 사이트 테마와 무관하게 어두운 배경인데 select 에 반투명 배경·연한 글자만 있고
// option 에는 색이 없어, 테마가 라이트면 흰 바탕에 흰 글자가 올라가 항목이 안 보였다
// (2026-10-19 국가 필터 "+N개 더"). 관리자 화면의 모든 select/option 은 이 두 상수를 붙이고,
// tests/unit/admin-native-select-dark.test.ts 가 누락을 막는다.
export const NATIVE_SELECT_CLASS = "[color-scheme:dark]";
export const NATIVE_OPTION_CLASS = "bg-[#1c1c1e] text-white";
