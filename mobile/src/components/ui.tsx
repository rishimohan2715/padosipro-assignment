import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { colors, radius, shadows, spacing } from "../theme/colors";

export function Screen({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
}) {
  return (
    <View style={[styles.screen, padded ? styles.screenPadded : null, style]}>{children}</View>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <View
      style={[
        styles.brand,
        { width: size, height: size, borderRadius: Math.round(size * 0.28) },
      ]}
    >
      <Text style={[styles.brandText, { fontSize: Math.round(size * 0.5) }]}>P</Text>
    </View>
  );
}

export function BrandRow({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.brandRow}>
      <BrandMark />
      <View style={{ marginLeft: spacing.sm }}>
        <Text style={styles.brandName}>PadosiPro</Text>
        {subtitle ? <Text style={styles.brandSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <View style={styles.stepper}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.stepDot,
            i < step ? styles.stepDotDone : null,
            i === step - 1 ? styles.stepDotCurrent : null,
          ]}
        />
      ))}
    </View>
  );
}

export function H1({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function P({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.p, style]}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
        style={[
          styles.input,
          focused ? styles.inputFocused : null,
          error ? styles.inputError : null,
          props.style,
        ]}
      />
      {error ? (
        <Text style={styles.err}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "secondary";
  size?: "md" | "lg";
}) {
  const isDisabled = disabled || loading;
  const base =
    variant === "primary"
      ? styles.btnPrimary
      : variant === "secondary"
      ? styles.btnSecondary
      : styles.btnGhost;
  const txt =
    variant === "primary"
      ? { color: colors.textOnPrimary }
      : variant === "secondary"
      ? { color: colors.primaryDark }
      : { color: colors.primary };
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        size === "lg" ? styles.btnLg : null,
        base,
        variant === "primary" && !isDisabled ? shadows.cta : null,
        isDisabled ? styles.btnDisabled : null,
        pressed && !isDisabled ? { transform: [{ scale: 0.98 }], opacity: 0.95 } : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.textOnPrimary : colors.primary} />
      ) : (
        <Text style={[styles.btnText, size === "lg" ? styles.btnTextLg : null, txt]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Banner({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const bg =
    tone === "error" ? colors.dangerSoft : tone === "success" ? colors.successSoft : colors.primarySoft;
  const fg =
    tone === "error" ? colors.danger : tone === "success" ? colors.success : colors.primaryDark;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontWeight: "600", fontSize: 13.5 }}>{children}</Text>
    </View>
  );
}

export function Chip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "primary" | "accent";
}) {
  const bg =
    tone === "primary" ? colors.primarySoft : tone === "accent" ? colors.accentSoft : colors.surfaceAlt;
  const fg =
    tone === "primary" ? colors.primaryDark : tone === "accent" ? colors.accent : colors.textMuted;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPadded: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 0 },

  brand: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cta,
  },
  brandText: { color: "#fff", fontWeight: "900", letterSpacing: -0.5 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  brandName: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  brandSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },

  stepper: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  stepDot: {
    height: 4,
    width: 28,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
  },
  stepDotDone: { backgroundColor: colors.primary },
  stepDotCurrent: { backgroundColor: colors.primary, width: 44 },

  h1: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.6,
    marginBottom: spacing.xs,
  },
  h2: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: spacing.xs,
  },
  p: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.textMuted, fontSize: 14.5, lineHeight: 21 },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 7,
  },
  input: {
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15.5,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  err: { color: colors.danger, fontSize: 12.5, marginTop: 5, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 12.5, marginTop: 5 },

  btn: {
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnLg: { paddingVertical: 17, minHeight: 56 },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.primarySoft },
  btnGhost: { backgroundColor: "transparent" },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontWeight: "700", fontSize: 15.5, letterSpacing: -0.1 },
  btnTextLg: { fontSize: 16.5 },

  banner: {
    padding: 13,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
});
