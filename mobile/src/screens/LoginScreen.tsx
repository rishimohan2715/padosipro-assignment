import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Banner, BrandRow, Button, Field, H1, Muted, Screen } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { useAuth, User } from "../store/auth";
import { colors, spacing } from "../theme/colors";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string | null> = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) e.email = "Enter a valid email.";
    if (!password) e.password = "Enter your password.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password },
      });
      await signIn(data.token, data.user);
    } catch (e) {
      if (e instanceof ApiRequestError) {
        if (e.code === "email_not_verified") {
          navigation.navigate("Verify", { email: email.trim().toLowerCase() });
          return;
        }
        setServerError(e.message);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
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
        <BrandRow subtitle="Welcome back home." />
        <H1>Log in</H1>
        <Muted style={{ marginBottom: spacing.lg }}>
          Pick up where you left off with your Lifestyle Manager.
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
          placeholder="••••••••"
        />
        <View style={{ height: spacing.sm }} />
        <Button title="Log in" onPress={onSubmit} loading={loading} size="lg" />
        <View style={{ marginTop: spacing.lg, alignItems: "center" }}>
          <Pressable onPress={() => navigation.navigate("Register")} hitSlop={10}>
            <Text style={{ color: colors.textMuted, fontSize: 14.5 }}>
              New here?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
