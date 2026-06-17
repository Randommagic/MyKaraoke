/** 앱 디자인 시스템 팔레트 (라이트·웜 톤 통일) */
export const DesignColors = {
  bg: "#FDF6F0",
  bgCard: "#FFF8F4",
  bgBorder: "#F0DDD0",

  textPrimary: "#3D2A1E",
  textSecondary: "#A0705A",
  textMuted: "#B08878",
  textFaint: "#D4B09A",

  /** 액센트 버튼·TJ 탭 활성 등 위 글자 */
  textOnAccent: "#ffffff",

  accent: "#E8825A",

  /** 장르·필터 칩 활성 배경 */
  filterChipActiveBg: "#FFF0E8",

  /** 차트 2위 순위 */
  chartRank2: "#C4A07A",

  /** 목록 행 구분선 */
  listDivider: "#F5EDE6",

  /** 차트 '내 목록' 뱃지 */
  inListBadgeBg: "#FDEBC8",
  inListCheck: "#C47A2A",

  /** 검색·입력 필드 배경 */
  inputSurface: "#FFF8F4",

  /** 토스트·스낵바 */
  toastBg: "#323232",
  toastText: "#ffffff",

  /** 위험 액션(삭제·초기화) */
  danger: "#c62828",

  /** 모달 딤 */
  scrim: "rgba(61, 42, 30, 0.42)",

  /** 디버그 로그 레벨 */
  logError: "#c62828",
  logWarn: "#f57f17",
  logInfo: "#1565c0",
  logDebug: "#546e7a",
  logDefault: "#37474f",

  badgeNoneBg: "#F1EFE8",
  badgeNoneText: "#5F5E5A",

  badgeDoneBg: "#E1F5EE",
  badgeDoneText: "#0F6E56",

  badgeTryBg: "#FAECE7",
  badgeTryText: "#993C1D",

  badgePracBg: "#E6F1FB",
  badgePracText: "#185FA5",

  badgeKeyBg: "#FFF0E8",
  badgeKeyText: "#854F0B",

  badgeMaleBg: "#E3EEFB",
  badgeMaleText: "#1A5FA8",

  badgeFemaleBg: "#FCE8EC",
  badgeFemaleText: "#B03050",

  dateToday: "#E8825A",
  dateWeekBg: "#FAECE7",
  dateWeekText: "#993C1D",
  dateWithin15Bg: "#FFF0E8",
  dateWithin15Text: "#A0705A",
  dateMonthBg: "#FFF0E8",
  dateMonthText: "#B08878",

  /** 외부 서비스 브랜드 색상 */
  youtube: "#FF0000",

  /** 스와이프 액션 (삭제·오늘 불렀음) */
  swipeDeleteBg: "#FACDCD",
  swipeDeleteText: "#8B2020",
  swipeSungBg: "#C8EFD8",
  swipeSungText: "#1A6640",
  swipeSungCancelBg: "#FDEBC8",
  swipeSungCancelText: "#8A5A00",
} as const;

/** SongCard와 동일 — 스와이프 액션 패널 모서리 */
export const DESIGN_CARD_RADIUS = 14;
