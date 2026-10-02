import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Banner, BrandRow, Button, Field, H1, Muted, Screen, Stepper } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { useAuth, User } from "../store/auth";
import { spacing } from "../theme/colors";

export default function ProfileScreen() {
  const { token, user, setUser } = useAuth();
  const [name, setName] = useState(user?.profile.name ?? "");
  const [mobile, setMobile] = useState(user?.profile.mobile ?? "+91");
  const [address, setAddress] = useState(user?.profile.address ?? "");
  const [businessName, setBusinessName] = useState(user?.profile.businessName ?? "");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string, string | null> = {};
    if (name.trim().length < 2) e.name = "Enter your name.";
    if (!/^\+91[6-9]\d{9}$/.test(mobile.trim()))
      e.mobile = "Enter a valid Indian mobile (+91 followed by 10 digits).";
    if (address.trim().length < 5) e.address = "Enter your address so we can reach you.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await api<{ user: User }>("/api/profile/me", {
        method: "PUT",
        token,
        body: {
          name: name.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
          businessName: businessName.trim() || undefined,
        },
      });
      setUser(data.user);
    } catch (e) {
      if (e instanceof ApiRequestError) setServerError(e.message);
      else setServerError("Something went wrong.");
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
          <BrandRow />
          <Stepper step={3} total={4} />
          <H1>A quick hello</H1>
          <Muted style={{ marginBottom: spacing.lg }}>
            Your Lifestyle Manager will use these details to pick up, drop off, and reach you.
          </Muted>
          {serverError ? <Banner>{serverError}</Banner> : null}
          <Field
            label="Your name"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="e.g. Priya Sharma"
            autoCapitalize="words"
          />
          <Field
            label="Mobile number"
            keyboardType="phone-pad"
            value={mobile}
            onChangeText={setMobile}
            error={errors.mobile}
            hint="We'll use this on WhatsApp — no spam, promise."
            placeholder="+91XXXXXXXXXX"
          />
          <Field
            label="Address"
            value={address}
            onChangeText={setAddress}
            error={errors.address}
            placeholder="Flat / street / city"
            multiline
            style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 13 }}
          />
          <Field
            label="Business name"
            hint="Optional — only if you run one."
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Sharma Textiles"
          />
          <View style={{ height: spacing.sm }} />
          <Button title="Save & continue" onPress={onSubmit} loading={loading} size="lg" />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
