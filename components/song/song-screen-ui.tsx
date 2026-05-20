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

export const SongUi = {
  accent: "#E8825A",
  text: "#3D2A1E",
  textSecondary: "#A0705A",
  textMuted: "#B08878",
  textFaint: "#D4B09A",
  cardBg: "#FFF8F4",
  border: "#F0DDD0",
  chipMetaBg: "#F1EFE8",
  chipMetaText: "#5F5E5A",
  youtube: "#C47A2A",
  danger: "#B03050",
  screenBg: DesignColors.bg,
  genderActiveBg: "#FFF0E8",
} as const;

const READINESS_CHIP_STYLE: Record<
  SongReadiness,
  { border: string; bg: string; color: string }
> = {
  none: { border: "#5F5E5A", bg: "#F1EFE8", color: "#5F5E5A" },
  can_full: { border: "#0F6E56", bg: "#E1F5EE", color: "#0F6E56" },
  need_practice: { border: "#185FA5", bg: "#E6F1FB", color: "#185FA5" },
  will_try: { border: "#993C1D", bg: "#FAECE7", color: "#993C1D" },
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
  return (
    <View style={readinessStyles.row}>
      {READINESS_SLIDER_ORDER.map((key) => {
        const selected = value === key;
        const chip = READINESS_CHIP_STYLE[key];
        const rv = READINESS_VISUAL[key];
        const label =
          SONG_READINESS_OPTIONS.find((o) => o.value === key)?.label ?? key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
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
  );
}

export function GenderKeyRow({
  value,
  onChange,
}: {
  value: SongGenderKey;
  onChange: (v: SongGenderKey) => void;
}) {
  return (
    <View style={genderStyles.row}>
      {GENDER_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
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
                selected ? genderStyles.btnTextActive : genderStyles.btnTextIdle,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
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
