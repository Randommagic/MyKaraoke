/**
 * 앱 디자인 토큰 (간격·radius·타이포·그림자).
 *
 * MyKaraoke 디자인 시스템 키트의 스케일을 React Native 값으로 옮긴 것.
 * 색상은 {@link ./colors.ts}의 `DesignColors`가 단일 출처입니다.
 *
 * 화면 StyleSheet에서 매직 넘버(14, 12, 20…) 대신 이 토큰을 참조하세요.
 */
import { Platform, type TextStyle, type ViewStyle } from "react-native";

/** 4 ~ 28px 스페이싱 스케일 (키트 --space-1 ~ --space-10) */
export const Spacing = {
  /** 4 */
  xs: 4,
  /** 6 */
  sm: 6,
  /** 8 */
  md: 8,
  /** 10 */
  lg: 10,
  /** 12 */
  xl: 12,
  /** 14 — 카드 세로 패딩 */
  xl2: 14,
  /** 16 — 화면 수평 패딩(좁게) */
  xl3: 16,
  /** 20 — 화면 수평 패딩(기본) */
  xl4: 20,
  /** 24 */
  xl5: 24,
  /** 28 */
  xl6: 28,
} as const;

/** 코너 레이디어스 (키트 --radius-*) */
export const Radius = {
  /** 6 — 작은 칩 내부 */
  xs: 6,
  /** 8 — 썸네일 */
  sm: 8,
  /** 12 — 입력 필드·버튼·모달 내 행 */
  md: 12,
  /** 14 — SongCard */
  card: 14,
  /** 16 — 모달 카드 */
  modal: 16,
  /** 완전 pill — 배지·칩·FAB */
  pill: 9999,
} as const;

/** 보더 두께 (키트 --border-*) */
export const Border = {
  width: 1,
  hairline: 0.5,
} as const;

/** 폰트 사이즈 스케일 (키트 --text-2xs ~ --text-2xl) */
export const FontSize = {
  /** 10 — 작은 캡션·로그·섹션 레이블 */
  xs2: 10,
  /** 11 — 배지·칩 */
  xs: 11,
  /** 13 — 보조 텍스트 */
  sm: 13,
  /** 14 — 본문·입력 필드 */
  base: 14,
  /** 15 — 버튼·보조 제목 */
  md: 15,
  /** 16 — 모달 버튼·설정 항목 */
  lg: 16,
  /** 18 — 모달 제목·상세 헤더 */
  xl: 18,
  /** 22 — 화면 제목(ScreenTitle) */
  xl2: 22,
} as const;

/** 폰트 두께 (RN 리터럴, 키트 --weight-*) */
export const FontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const satisfies Record<string, TextStyle["fontWeight"]>;

/** 자간 (키트 --tracking-*) */
export const LetterSpacing = {
  /** -0.5 — 화면 제목 */
  tight: -0.5,
  normal: 0,
  /** 0.4 — 섹션 레이블(uppercase) */
  loose: 0.4,
} as const;

/** 줄 간격 — 배지는 고정 px, 나머지는 배수 */
export const LineHeight = {
  badge: 14,
  tight: 1.25,
  normal: 1.4,
  body: 1.5,
} as const;

/**
 * 그림자 — iOS(shadow*)·Android(elevation) 동시 지정.
 * 키트는 그림자 거의 없는 flat 디자인이라 모달·FAB 등 소수에만 사용.
 */
export const Shadow = {
  /** 0 1px 3px rgba(61,42,30,0.06) — 카드(거의 안 씀) */
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#3D2A1E",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    default: {},
  }),
  /** 0 4px 24px rgba(61,42,30,0.14) — 모달 */
  modal: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#3D2A1E",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }),
  /** 0 4px 16px rgba(232,130,90,0.38) — FAB */
  fab: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#E8825A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.38,
      shadowRadius: 16,
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;
