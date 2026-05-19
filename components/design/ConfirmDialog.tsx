import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DesignColors } from "@/components/design/colors";

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** true면 확인 버튼만 (알림형) */
  alert?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  destructive = false,
  alert = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={alert ? onConfirm : onCancel}
          accessibilityLabel="닫기"
        />
        <View style={styles.card}>
          <Text style={[styles.title, !message && styles.titleOnly]}>
            {title}
          </Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.actions, alert && styles.actionsAlertOnly]}>
            {!alert ? (
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.cancelLabel}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                destructive ? styles.confirmBtnDestructive : null,
                alert ? styles.confirmBtnAlertOnly : null,
                { opacity: pressed ? 0.88 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.confirmLabel,
                  destructive ? styles.confirmLabelDestructive : null,
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DesignColors.scrim,
  },
  card: {
    backgroundColor: DesignColors.bgCard,
    borderWidth: 1,
    borderColor: DesignColors.bgBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: DesignColors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  titleOnly: {
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: DesignColors.textSecondary,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionsAlertOnly: {
    justifyContent: "center",
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: DesignColors.textMuted,
  },
  confirmBtn: {
    backgroundColor: DesignColors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 72,
    alignItems: "center",
  },
  confirmBtnDestructive: {
    backgroundColor: DesignColors.swipeDeleteBg,
    borderWidth: 1,
    borderColor: DesignColors.swipeDeleteText,
  },
  confirmBtnAlertOnly: {
    minWidth: 120,
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: DesignColors.textOnAccent,
  },
  confirmLabelDestructive: {
    color: DesignColors.swipeDeleteText,
  },
});
