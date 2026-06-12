/**
 * 곡 입력 폼의 공용 조각.
 *
 * 추가 모달(홈)과 편집 화면이 똑같이 쓰던 기본 정보 필드(제목·가수·곡 번호)와
 * 음정 스테퍼를 한곳으로 모은 것. 준비도·남녀 키는 song-screen-ui의
 * {@link ReadinessChipRow}·{@link GenderKeyRow}를 그대로 재사용한다.
 */
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardAwareField } from "@/components/design/keyboard-aware-scroll";
import { Radius, Spacing } from "@/components/design/tokens";
import {
  FieldLabel,
  SongUi,
  songFieldStyles,
} from "@/components/song/song-screen-ui";
import { formatTranspose, sanitizeKaraokeDigits } from "@/lib/song-form-helpers";

/** 음정 전치 범위(반음) */
export const TRANSPOSE_MIN = -12;
export const TRANSPOSE_MAX = 12;

function clampTranspose(v: number): number {
  return Math.max(TRANSPOSE_MIN, Math.min(TRANSPOSE_MAX, v));
}

function FocusableInput({
  fieldKey,
  focusedField,
  setFocusedField,
  marginBottom = Spacing.xl2,
  ...inputProps
}: {
  fieldKey: string;
  focusedField: string | null;
  setFocusedField: (key: string | null) => void;
  marginBottom?: number;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <KeyboardAwareField>
      <TextInput
        placeholderTextColor={SongUi.textFaint}
        onFocus={() => setFocusedField(fieldKey)}
        onBlur={() => setFocusedField(null)}
        style={[
          songFieldStyles.input,
          focusedField === fieldKey ? songFieldStyles.inputFocused : null,
          { marginBottom },
        ]}
        {...inputProps}
      />
    </KeyboardAwareField>
  );
}

/**
 * 제목·가수·곡 번호(태진/금영) — 추가·편집 공통 기본 필드.
 * 입력 포커스 하이라이트는 내부에서 관리한다.
 */
export function SongBasicFields({
  title,
  onTitleChange,
  artist,
  onArtistChange,
  tjNumber,
  onTjNumberChange,
  kyNumber,
  onKyNumberChange,
  autoFocusTitle = false,
}: {
  title: string;
  onTitleChange: (v: string) => void;
  artist: string;
  onArtistChange: (v: string) => void;
  tjNumber: string;
  onTjNumberChange: (v: string) => void;
  kyNumber: string;
  onKyNumberChange: (v: string) => void;
  autoFocusTitle?: boolean;
}) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  return (
    <>
      <FieldLabel>노래 제목</FieldLabel>
      <FocusableInput
        fieldKey="title"
        focusedField={focusedField}
        setFocusedField={setFocusedField}
        value={title}
        onChangeText={onTitleChange}
        placeholder="제목"
        autoFocus={autoFocusTitle}
      />

      <FieldLabel>가수</FieldLabel>
      <FocusableInput
        fieldKey="artist"
        focusedField={focusedField}
        setFocusedField={setFocusedField}
        value={artist}
        onChangeText={onArtistChange}
        placeholder="가수명"
      />

      <FieldLabel>곡 번호</FieldLabel>
      <View style={styles.numberRow}>
        <View style={styles.numberCol}>
          <Text style={songFieldStyles.subLabel}>태진</Text>
          <FocusableInput
            fieldKey="tj"
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            value={tjNumber}
            onChangeText={(text) => onTjNumberChange(sanitizeKaraokeDigits(text))}
            placeholder="번호"
            keyboardType="number-pad"
            maxLength={6}
            marginBottom={0}
          />
        </View>
        <View style={styles.numberCol}>
          <Text style={songFieldStyles.subLabel}>금영</Text>
          <FocusableInput
            fieldKey="ky"
            focusedField={focusedField}
            setFocusedField={setFocusedField}
            value={kyNumber}
            onChangeText={(text) => onKyNumberChange(sanitizeKaraokeDigits(text))}
            placeholder="번호"
            keyboardType="number-pad"
            maxLength={6}
            marginBottom={0}
          />
        </View>
      </View>
    </>
  );
}

/** 음정(키 업/다운) ± 스테퍼 — 반음 단위, ±12까지. */
export function TransposeStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.transposeRow}>
      <Pressable
        onPress={() => onChange(clampTranspose(value - 1))}
        style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel="키 다운"
      >
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <View style={styles.transposeCenter}>
        <Text style={styles.transposeValue}>{formatTranspose(value)}</Text>
        <Text style={styles.transposeHint}>반음 ±12까지</Text>
      </View>
      <Pressable
        onPress={() => onChange(clampTranspose(value + 1))}
        style={({ pressed }) => [styles.stepBtn, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityLabel="키 업"
      >
        <Text style={styles.stepBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  numberRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.xl2,
  },
  numberCol: { flex: 1 },
  transposeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    marginBottom: Spacing.xl4,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: SongUi.border,
    backgroundColor: SongUi.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 20,
    color: SongUi.textSecondary,
    fontWeight: "500",
  },
  transposeCenter: {
    flex: 1,
    alignItems: "center",
  },
  transposeValue: {
    fontSize: 18,
    fontWeight: "500",
    color: SongUi.text,
  },
  transposeHint: {
    marginTop: 2,
    fontSize: 11,
    color: SongUi.textMuted,
  },
});
