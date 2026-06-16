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
  onboarding: {
    /** 설정 메뉴 항목 */
    menuLabel: "사용법",
    /** 홈 빈 화면 */
    emptyTitle: "아직 곡이 없어요",
    emptyDesc: "아래 + 버튼을 눌러 첫 애창곡을 추가해보세요",
    /** 데모 예시 카드 배지 */
    example: "예시",
    replay: "다시 보기",
    /** 도움말 시트 */
    sheetTitle: "노래 목록 다루기",
    swipeTitle: "카드를 좌우로 밀어보세요",
    sheetSubtitle: "목록에서 카드를 밀면 빠르게 기록하거나 지울 수 있어요",
    tapHint: "카드를 누르면 상세정보가 열려요",
    dragHint: "핸들을 잡고 위아래로 옮기면 순서가 바뀌어요",
  },
} as const;

export type SungRecencyLabel =
  (typeof UI_STRINGS.sungRecency)[keyof typeof UI_STRINGS.sungRecency];
