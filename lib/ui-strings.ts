/**
 * 앱 전역 짧은 UI 문구 (뱃지·칩·폼 옵션·스와이프 라벨 등).
 * 화면별 긴 안내·에러 메시지는 각 화면/모듈에 둡니다.
 */
export const UI_STRINGS = {
  filter: {
    all: "전체",
  },
  readiness: {
    none: "미정",
    can_full: "완창",
    need_practice: "연습",
    will_try: "시도",
  },
  gender: {
    unset: "미정",
    male: "남키",
    female: "여키",
  },
  genderBadge: {
    male: "남",
    female: "여",
  },
  key: {
    original: "원키",
  },
  sungRecency: {
    today: "오늘",
    week: "일주일 이내",
    within15: "15일 이내",
    month: "30일 이내",
  },
  importSource: {
    manual: "직접 입력",
    youtube: "YouTube에서",
    tj: "TJ에서",
  },
  swipe: {
    sungToday: "오늘 불렀음",
    sungTodayCancel: "오늘 취소",
  },
  songDetail: {
    sungToday: "오늘 불렀음",
    sungTodayCancel: "오늘 부름 취소",
  },
} as const;

export type SungRecencyLabel =
  (typeof UI_STRINGS.sungRecency)[keyof typeof UI_STRINGS.sungRecency];
