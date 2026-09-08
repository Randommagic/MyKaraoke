/**
 * 곡 입력 폼의 공용 조각.
 *
 * 추가 모달(홈)과 편집 화면이 똑같이 쓰던 기본 정보 필드(제목·가수·곡 번호)와
 * 음정 스테퍼를 한곳으로 모은 것. 준비도·남녀 키는 song-screen-ui의
 * {@link ReadinessChipRow}·{@link GenderKeyRow}를 그대로 재사용한다.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardAwareField } from "@/components/design/keyboard-aware-scroll";
import { Radius, Spacing } from "@/components/design/tokens";
import {
  FieldLabel,
  SongUi,
  songFieldStyles,
} from "@/components/song/song-screen-ui";
import { formatTranspose, sanitizeKaraokeDigits } from "@/lib/song-form-helpers";
import { MAX_SONG_MEMO_LENGTH } from "@/lib/songs-storage";
import { UI_STRINGS } from "@/lib/ui-strings";

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

/**
 * 메모 입력 + 글자 수 카운터. 최대 {@link MAX_SONG_MEMO_LENGTH}자.
 * 추가 모달(드래프트)·곡 상세(blur 저장) 양쪽에서 사용.
 */
export function MemoField({
  value,
  onChangeText,
  onBlur,
  placeholder = "간단히 적어두기",
}: {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  return (
    <>
      <KeyboardAwareField>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          maxLength={MAX_SONG_MEMO_LENGTH}
          placeholder={placeholder}
          placeholderTextColor={SongUi.textFaint}
          multiline
          textAlignVertical="top"
          style={styles.memoInput}
        />
      </KeyboardAwareField>
      <Text style={styles.memoCounter}>
        [{value.length}/{MAX_SONG_MEMO_LENGTH}]
      </Text>
    </>
  );
}

/**
 * 음정(키 업/다운) 순환 스테퍼 — 반음 단위, ±12까지.
 *
 * 값의 배열을 `… -2 -1 0(원키) 미정 0(원키) +1 +2 …` 형태의 순환으로 다룬다.
 * - 미정에서 − → 왼쪽 원키(0), 이후 −로 -1, -2 … 하강
 * - 미정에서 + → 오른쪽 원키(0), 이후 +로 +1, +2 … 상승
 * - 오른쪽 0에서 − → 미정, 왼쪽 0에서 + → 미정
 *
 * `0`이 미정 양옆에 두 번 등장하므로, 어느 쪽 0인지 구분하기 위해
 * 진입 방향(`side`)을 로컬 상태로 둔다(저장 값은 여전히 number|null).
 */
export function TransposeStepper({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const isUnset = value === null;
  // 0이 미정 양옆에 있으므로, 현재 0이 음수쪽/양수쪽 중 어디인지 기억한다.
  // 값이 있으면 부호로 판정(0은 양수쪽으로 간주), 미정이면 이전 side 유지.
  const [side, setSide] = useState<"neg" | "pos">(
    value !== null && value < 0 ? "neg" : "pos",
  );

  // 외부에서 value가 바뀌면(저장 후 리렌더·다른 곡 로드 등) side가 stale해질 수
  // 있다. 부호가 확실한 값(양수/음수)은 side를 강제로 맞춘다.
  // 0과 미정(null)은 방향이 모호하므로 직전 조작이 정한 side를 유지한다.
  useEffect(() => {
    if (value !== null && value > 0) setSide("pos");
    else if (value !== null && value < 0) setSide("neg");
  }, [value]);

  const handleDown = () => {
    // 배열: -2 -1 (neg 0) 미정 (pos 0) +1 +2  →  −는 왼쪽으로 이동
    if (isUnset) {
      // 미정 → 왼쪽(neg쪽) 원키(0)
      setSide("neg");
      onChange(0);
      return;
    }
    if (value === 0 && side === "pos") {
      // pos쪽 원키에서 왼쪽(−) → 미정
      onChange(null);
      return;
    }
    // neg쪽 0 → -1, 그 외 음수는 계속 하강. (양수는 값이 줄며 pos 유지)
    if (value > 0) setSide("pos");
    else setSide("neg");
    onChange(clampTranspose(value - 1));
  };

  const handleUp = () => {
    // +는 오른쪽으로 이동
    if (isUnset) {
      // 미정 → 오른쪽(pos쪽) 원키(0)
      setSide("pos");
      onChange(0);
      return;
    }
    if (value === 0 && side === "neg") {
      // neg쪽 원키에서 오른쪽(+) → 미정
      onChange(null);
      return;
    }
    // pos쪽 0 → +1, 그 외 양수는 계속 상승. (음수는 값이 커지며 neg 유지)
    if (value < 0) setSide("neg");
    else setSide("pos");
    onChange(clampTranspose(value + 1));
  };

  return (
    <View style={styles.transposeBlock}>
      <View style={styles.transposeRow}>
        <Pressable
          onPress={handleDown}
          style={({ pressed }) => [
            styles.stepBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="키 다운"
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <View style={styles.transposeCenter}>
          <Text
            style={[
              styles.transposeValue,
              isUnset ? styles.transposeValueUnset : null,
            ]}
          >
            {isUnset ? UI_STRINGS.key.unset : formatTranspose(value)}
          </Text>
          {isUnset ? (
            <Text style={styles.transposeHint}>− / + 를 눌러 설정</Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleUp}
          style={({ pressed }) => [
            styles.stepBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityLabel="키 업"
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
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
  memoInput: {
    borderWidth: 1,
    borderColor: SongUi.border,
    borderRadius: Radius.md,
    backgroundColor: SongUi.cardBg,
    minHeight: 80,
    paddingHorizontal: Spacing.xl2,
    paddingVertical: Spacing.xl,
    fontSize: 14,
    color: SongUi.text,
    marginBottom: Spacing.xs,
  },
  memoCounter: {
    alignSelf: "flex-end",
    fontSize: 11,
    color: SongUi.textFaint,
    marginBottom: Spacing.xl4,
  },
  transposeBlock: {
    marginBottom: Spacing.xl4,
  },
  transposeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
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
  transposeValueUnset: {
    color: SongUi.textFaint,
  },
  transposeHint: {
    marginTop: 2,
    fontSize: 11,
    color: SongUi.textMuted,
  },
});
