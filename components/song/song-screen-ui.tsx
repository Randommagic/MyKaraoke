import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { DesignColors } from "@/components/design/colors";
import {
  GENDER_OPTIONS,
  READINESS_VISUAL,
} from "@/lib/song-form-helpers";
import {
  READINESS_SLIDER_ORDER,
  SONG_READINESS_OPTIONS,
  type SongGenderKey,
  type SongReadiness,
} from "@/lib/songs-storage";

/**
 * 곡 화면(상세·편집) 색 별칭. 값은 모두 {@link DesignColors}를 가리킨다.
 * 두 값(youtube·danger)만 곡 화면 전용이라 대응 토큰이 없어 리터럴로 둔다.
 */
export const SongUi = {
  accent: DesignColors.accent,
  text: DesignColors.textPrimary,
  textSecondary: DesignColors.textSecondary,
  textMuted: DesignColors.textMuted,
  textFaint: DesignColors.textFaint,
  cardBg: DesignColors.bgCard,
  border: DesignColors.bgBorder,
  chipMetaBg: DesignColors.badgeNoneBg,
  chipMetaText: DesignColors.badgeNoneText,
  /** YouTube 링크 강조 — DesignColors에 대응 토큰 없는 곡 화면 전용 색 */
  youtube: "#C47A2A",
  /** 곡 화면 삭제·해제 — 앱 공통 danger(#c62828)보다 부드러운 톤 */
  danger: "#B03050",
  screenBg: DesignColors.bg,
  genderActiveBg: DesignColors.filterChipActiveBg,
} as const;

const READINESS_CHIP_STYLE: Record<
  SongReadiness,
  { border: string; bg: string; color: string }
> = {
  none: {
    border: DesignColors.badgeNoneText,
    bg: DesignColors.badgeNoneBg,
    color: DesignColors.badgeNoneText,
  },
  can_full: {
    border: DesignColors.badgeDoneText,
    bg: DesignColors.badgeDoneBg,
    color: DesignColors.badgeDoneText,
  },
  need_practice: {
    border: DesignColors.badgePracText,
    bg: DesignColors.badgePracBg,
    color: DesignColors.badgePracText,
  },
  will_try: {
    border: DesignColors.badgeTryText,
    bg: DesignColors.badgeTryBg,
    color: DesignColors.badgeTryText,
  },
};

export function SongScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={headerStyles.bar}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [
          headerStyles.sideBtn,
          headerStyles.sideLeft,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <Ionicons name="chevron-back" size={26} color={SongUi.accent} />
      </Pressable>
      <Text style={headerStyles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[headerStyles.sideBtn, headerStyles.sideRight]}>
        {right ?? null}
      </View>
    </View>
  );
}

export function EditPillButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        headerStyles.editPill,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="편집"
    >
      <Ionicons name="pencil-outline" size={14} color={SongUi.textSecondary} />
      <Text style={headerStyles.editPillText}>편집</Text>
    </Pressable>
  );
}

export function SectionDivider({ label }: { label: string }) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.label}>{label}</Text>
      <View style={sectionStyles.line} />
    </View>
  );
}

export function FieldLabel({ children }: { children: string }) {
  return <Text style={fieldStyles.label}>{children}</Text>;
}

export function ReadinessChipRow({
  value,
  onChange,
}: {
  value: SongReadiness;
  onChange: (v: SongReadiness) => void;
}) {
  // "미정"(none)은 선택지에서 제외 — 아무 칩도 고르지 않은 상태가 곧 미정.
  const options = READINESS_SLIDER_ORDER.filter((key) => key !== "none");
  const isUnset = value === "none";

  return (
    <View>
      {isUnset ? (
        <Text style={selectHintStyles.hint}>아래에서 선택하세요</Text>
      ) : null}
      <View style={readinessStyles.row}>
        {options.map((key) => {
          const selected = value === key;
          const chip = READINESS_CHIP_STYLE[key];
          const rv = READINESS_VISUAL[key];
          const label =
            SONG_READINESS_OPTIONS.find((o) => o.value === key)?.label ?? key;
          return (
            <Pressable
              key={key}
              // 선택된 칩을 다시 누르면 해제되어 미정(none)으로 복귀.
              onPress={() => onChange(selected ? "none" : key)}
              style={({ pressed }) => [
                readinessStyles.chip,
                {
                  borderColor: selected ? chip.border : SongUi.border,
                  backgroundColor: selected ? chip.bg : SongUi.cardBg,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Ionicons
                name={rv.icon}
                size={18}
                color={selected ? chip.color : SongUi.textMuted}
              />
              <Text
                style={[
                  readinessStyles.chipText,
                  { color: selected ? chip.color : SongUi.textSecondary },
                  selected ? readinessStyles.chipTextActive : null,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function GenderKeyRow({
  value,
  onChange,
}: {
  value: SongGenderKey;
  onChange: (v: SongGenderKey) => void;
}) {
  // "미정"(unset)은 선택지에서 제외 — 아무 칩도 고르지 않은 상태가 곧 미정.
  const options = GENDER_OPTIONS.filter((opt) => opt.value !== "unset");
  const isUnset = value === "unset";

  return (
    <View>
      {isUnset ? (
        <Text style={selectHintStyles.hint}>아래에서 선택하세요</Text>
      ) : null}
      <View style={genderStyles.row}>
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              // 선택된 칩을 다시 누르면 해제되어 미정(unset)으로 복귀.
              onPress={() => onChange(selected ? "unset" : opt.value)}
              style={({ pressed }) => [
                genderStyles.btn,
                selected ? genderStyles.btnActive : genderStyles.btnIdle,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  genderStyles.btnText,
                  selected
                    ? genderStyles.btnTextActive
                    : genderStyles.btnTextIdle,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const songFieldStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: SongUi.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: SongUi.text,
    backgroundColor: SongUi.cardBg,
  },
  inputFocused: {
    borderColor: SongUi.accent,
    backgroundColor: "#fff",
  },
  subLabel: {
    fontSize: 11,
    color: SongUi.textMuted,
    marginBottom: 6,
  },
});

const headerStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: SongUi.screenBg,
  },
  sideBtn: {
    width: 80,
    minHeight: 36,
    justifyContent: "center",
  },
  sideLeft: {
    alignItems: "flex-start",
  },
  sideRight: {
    alignItems: "flex-end",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
    color: SongUi.text,
  },
  editPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SongUi.border,
    backgroundColor: SongUi.cardBg,
    alignSelf: "flex-end",
  },
  editPillText: {
    fontSize: 13,
    color: SongUi.textSecondary,
  },
});

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
  },
  label: {
    fontSize: 10,
    color: SongUi.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: SongUi.border,
  },
});

const fieldStyles = StyleSheet.create({
  label: {
    fontSize: 14,
    color: SongUi.textSecondary,
    marginBottom: 8,
  },
});

const selectHintStyles = StyleSheet.create({
  hint: {
    fontSize: 12,
    color: SongUi.textMuted,
    marginBottom: 8,
  },
});

const readinessStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  chipTextActive: {
    fontWeight: "600",
  },
});

const genderStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  btn: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnIdle: {
    backgroundColor: SongUi.cardBg,
    borderColor: SongUi.border,
  },
  btnActive: {
    backgroundColor: SongUi.genderActiveBg,
    borderColor: SongUi.accent,
  },
  btnText: {
    fontSize: 14,
  },
  btnTextIdle: {
    color: SongUi.textSecondary,
  },
  btnTextActive: {
    color: SongUi.accent,
    fontWeight: "500",
  },
});
