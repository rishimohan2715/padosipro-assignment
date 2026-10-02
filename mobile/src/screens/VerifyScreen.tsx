import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Banner, BrandRow, Button, Field, H1, Muted, Screen, Stepper } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { useAuth, User } from "../store/auth";
import { colors, radius, spacing } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Verify">;

export default function VerifyScreen({ route }: Props) {
  const { email } = route.params;
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCooldown(30);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const onVerify = async () => {
    setErr(null);
    setInfo(null);
    if (!/^\d{6}$/.test(code)) {
      setErr("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>("/api/auth/verify-email", {
        method: "POST",
        body: { email, code },
      });
      await signIn(data.token, data.user);
    } catch (e) {
      if (e instanceof ApiRequestError) setErr(e.message);
      else setErr("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setErr(null);
    setInfo(null);
    setResending(true);
    try {
      const data = await api<{ resendInSeconds: number }>("/api/auth/resend-otp", {
        method: "POST",
        body: { email },
      });
      setInfo("A fresh code is on its way.");
      startCooldown(data.resendInSeconds ?? 30);
    } catch (e) {
      if (e instanceof ApiRequestError) setErr(e.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <BrandRow />
      <Stepper step={2} total={4} />
      <H1>Check your inbox</H1>
      <Muted style={{ marginBottom: spacing.lg }}>
        We sent a 6-digit code to{" "}
        <Text style={{ color: colors.text, fontWeight: "700" }}>{email}</Text>. Enter it below to
        continue.
      </Muted>
      {err ? <Banner>{err}</Banner> : null}
      {info ? <Banner tone="success">{info}</Banner> : null}
      <Field
        label="Verification code"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
        placeholder="— — — — — —"
        style={styles.otp}
      />
      <View style={{ height: spacing.sm }} />
      <Button title="Verify & continue" onPress={onVerify} loading={loading} size="lg" />
      <View style={styles.resend}>
        {cooldown > 0 ? (
          <Muted>
            Didn't get it? Resend available in{" "}
            <Text style={{ color: colors.text, fontWeight: "700" }}>{cooldown}s</Text>
          </Muted>
        ) : (
          <Pressable onPress={onResend} disabled={resending} hitSlop={10}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
              {resending ? "Sending…" : "Resend code"}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  otp: {
    fontSize: 26,
    letterSpacing: 12,
    textAlign: "center",
    paddingVertical: 18,
    fontWeight: "700",
    borderRadius: radius.lg,
  },
  resend: { marginTop: spacing.lg, alignItems: "center" },
});
