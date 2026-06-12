/**
 * Pretendard 전역 적용.
 *
 * RN에서는 커스텀 폰트에 `fontWeight`가 제대로 먹지 않아, weight별로 다른
 * 폰트 파일(`Pretendard-Medium` 등)을 `fontFamily`로 직접 지정해야 한다.
 * 앱 전역의 `fontWeight`를 일일이 바꾸는 대신, Text/TextInput의 렌더를 한 번
 * 가로채 스타일의 `fontWeight`를 보고 맞는 Pretendard 패밀리를 주입한다.
 *
 * - 이미 `fontFamily`가 지정된 텍스트(예: 로그 화면 monospace)는 건드리지 않음
 * - {@link app/_layout.tsx}에서 폰트 로드 게이팅 뒤 1회 호출
 */
import { cloneElement, type ReactElement } from "react";
import { StyleSheet, Text, TextInput } from "react-native";

export const PRETENDARD_FONTS = {
  "Pretendard-Regular": require("@/assets/fonts/Pretendard-Regular.otf"),
  "Pretendard-Medium": require("@/assets/fonts/Pretendard-Medium.otf"),
  "Pretendard-SemiBold": require("@/assets/fonts/Pretendard-SemiBold.otf"),
  "Pretendard-Bold": require("@/assets/fonts/Pretendard-Bold.otf"),
} as const;

const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": "Pretendard-Regular",
  "200": "Pretendard-Regular",
  "300": "Pretendard-Regular",
  "400": "Pretendard-Regular",
  normal: "Pretendard-Regular",
  "500": "Pretendard-Medium",
  "600": "Pretendard-SemiBold",
  "700": "Pretendard-Bold",
  "800": "Pretendard-Bold",
  "900": "Pretendard-Bold",
  bold: "Pretendard-Bold",
};

function familyForWeight(weight: unknown): string {
  if (weight == null) return "Pretendard-Regular";
  return WEIGHT_TO_FAMILY[String(weight)] ?? "Pretendard-Regular";
}

let installed = false;

/** Text/TextInput 기본 폰트를 Pretendard로 매핑. 중복 호출 무해. */
export function installPretendard() {
  if (installed) return;
  installed = true;
  patchComponent(Text);
  patchComponent(TextInput);
}

function patchComponent(Component: any) {
  const original = Component.render;
  if (typeof original !== "function") return;

  Component.render = function patchedRender(...args: any[]) {
    const element = original.apply(this, args) as ReactElement<{
      style?: unknown;
    }> | null;
    if (!element) return element;

    const flattened = StyleSheet.flatten(element.props.style) as
      | { fontFamily?: string; fontWeight?: unknown }
      | undefined;

    // 이미 폰트가 지정돼 있으면(monospace 등) 존중
    if (flattened?.fontFamily) return element;

    const fontFamily = familyForWeight(flattened?.fontWeight);
    return cloneElement(element, {
      style: [{ fontFamily }, element.props.style],
    });
  };
}
