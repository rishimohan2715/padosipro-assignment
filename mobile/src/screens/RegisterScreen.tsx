import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Banner, BrandRow, Button, Field, H1, Muted, Screen, Stepper } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { colors, spacing } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string | null> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Enter a valid email.";
    if (password.length < 8) e.password = "At least 8 characters.";
    if (password !== confirm) e.confirm = "Passwords don't match.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password },
      });
      navigation.navigate("Verify", { email: email.trim().toLowerCase() });
    } catch (e) {
      if (e instanceof ApiRequestError) setServerError(e.message);
      else setServerError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BrandRow subtitle="Your household, handled." />
          <Stepper step={1} total={4} />
          <H1>Create your account</H1>
          <Muted style={{ marginBottom: spacing.lg }}>
            A dedicated Lifestyle Manager, one message away. Let's start with your email.
          </Muted>
          {serverError ? <Banner>{serverError}</Banner> : null}
          <Field
            label="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            hint="At least 8 characters. Pick something memorable."
            placeholder="••••••••"
          />
          <Field
            label="Confirm password"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            error={errors.confirm}
            placeholder="••••••••"
          />
          <View style={{ height: spacing.sm }} />
          <Button title="Continue" onPress={onSubmit} loading={loading} size="lg" />
          <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
            <Pressable onPress={() => navigation.navigate("Login")} hitSlop={10}>
              <Text style={{ color: colors.textMuted, fontSize: 14.5 }}>
                Already with us?{" "}
                <Text style={{ color: colors.primary, fontWeight: "700" }}>Log in</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
