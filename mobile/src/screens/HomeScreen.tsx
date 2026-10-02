import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Banner, BrandMark, Button, H1, Muted, Screen } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../store/auth";
import {
  CATEGORY_EMOJI,
  colors,
  heroGradient,
  radius,
  shadows,
  spacing,
} from "../theme/colors";

type Task = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  categorySlug?: string;
};

const MANAGERS = [
  { name: "Anjali Kapoor", initials: "AK" },
  { name: "Rohan Mehta", initials: "RM" },
  { name: "Divya Nair", initials: "DN" },
  { name: "Imran Qureshi", initials: "IQ" },
];

function pickManager(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MANAGERS[h % MANAGERS.length];
}

function firstName(name?: string | null) {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}

function initialsOf(name?: string | null) {
  if (!name) return "You";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen({ onEditTasks }: { onEditTasks: () => void }) {
  const { token, user, signOut } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const data = await api<{ tasks: Task[] }>("/api/tasks/selections", { token });
      setTasks(data.tasks);
    } catch (e) {
      if (e instanceof ApiRequestError) setErr(e.message);
      else setErr("Couldn't load your tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, { label: string; slug: string; items: Task[] }>();
    for (const t of tasks) {
      const slug = t.categorySlug ?? "home";
      if (!map.has(slug)) map.set(slug, { label: t.category, slug, items: [] });
      map.get(slug)!.items.push(t);
    }
    return [...map.values()];
  }, [tasks]);

  const manager = useMemo(() => pickManager(user?.email ?? "padosipro"), [user?.email]);

  const confirmLogout = () =>
    Alert.alert("Log out?", "You can log back in anytime.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: signOut },
    ]);

  const contactManager = () =>
    Alert.alert(
      `Message ${manager.name.split(" ")[0]}`,
      "In the full product this opens a WhatsApp thread with your Lifestyle Manager. Mocked for this assignment.",
      [{ text: "Got it" }]
    );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const name = firstName(user?.profile.name);
  const estHours = Math.max(1, Math.round(tasks.length * 1.5));

  return (
    <Screen padded={false}>
      <View style={styles.topBar}>
        <View style={styles.topBrand}>
          <BrandMark size={30} />
          <Text style={styles.topBrandName}>PadosiPro</Text>
        </View>
        <View style={styles.topRight}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{initialsOf(user?.profile.name)}</Text>
          </View>
          <Pressable onPress={confirmLogout} hitSlop={12} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.greet}>{greeting()},</Text>
        <H1 style={{ fontSize: 30, marginBottom: 2 }}>{name} 👋</H1>
        <Muted style={{ marginBottom: spacing.lg }}>
          You don't manage tasks — we do. Here's your household at a glance.
        </Muted>

        {err ? <Banner>{err}</Banner> : null}

        {/* Lifestyle Manager hero */}
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroGlow} />
          <Text style={styles.heroLabel}>YOUR LIFESTYLE MANAGER</Text>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatar}>
              <Text style={styles.heroAvatarText}>{manager.initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroName}>{manager.name}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Online · usually replies in 5 min</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={contactManager} style={styles.heroCta}>
            <Text style={styles.heroCtaText}>Message {manager.name.split(" ")[0]}</Text>
          </Pressable>
          <Text style={styles.heroFoot}>One message. We handle the rest.</Text>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat value={String(tasks.length)} label={tasks.length === 1 ? "Service" : "Services"} />
          <Stat value={String(grouped.length)} label="Categories" />
          <Stat value={`~${estHours}h`} label="Saved / week" accent />
        </View>

        {/* Tasks */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>What we're handling</Text>
            <Text style={styles.sectionSub}>Tap edit to add or remove services</Text>
          </View>
          <Pressable onPress={onEditTasks} hitSlop={10} style={styles.editBtn}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🌿</Text>
            <Text style={styles.emptyTitle}>Nothing selected yet</Text>
            <Muted style={{ textAlign: "center", marginBottom: spacing.md, maxWidth: 280 }}>
              Pick the tasks you'd like {manager.name.split(" ")[0]} to handle — we'll take it from
              there.
            </Muted>
            <Button title="Browse tasks" onPress={onEditTasks} size="lg" />
          </View>
        ) : (
          grouped.map((g) => (
            <View key={g.slug} style={{ marginBottom: spacing.lg }}>
              <View style={styles.catRow}>
                <Text style={styles.catEmoji}>{CATEGORY_EMOJI[g.slug] ?? "✨"}</Text>
                <Text style={styles.catName}>{g.label}</Text>
                <Text style={styles.catCount}>{g.items.length}</Text>
              </View>
              <View style={styles.grid}>
                {g.items.map((t) => (
                  <View key={t.id} style={styles.tile}>
                    <View style={styles.tileTop}>
                      <Text style={styles.tileEmoji}>{CATEGORY_EMOJI[g.slug] ?? "✨"}</Text>
                      <View style={styles.tileDot} />
                    </View>
                    <Text style={styles.tileName} numberOfLines={2}>
                      {t.name}
                    </Text>
                    <Text style={styles.tileDesc} numberOfLines={2}>
                      {t.description}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Need something that isn't listed? Just ask {manager.name.split(" ")[0]}.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={[styles.stat, accent ? styles.statAccent : null]}>
      <Text style={[styles.statValue, accent ? { color: colors.accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  topBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  topBrandName: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  topRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontSize: 12, fontWeight: "800", color: colors.primaryDark },
  logoutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  logoutText: { color: colors.text, fontWeight: "700", fontSize: 12.5 },

  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  greet: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.cta,
  },
  heroGlow: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: spacing.md,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 0.5 },
  heroName: { color: "#fff", fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4ADE80",
  },
  statusText: { color: "rgba(255,255,255,0.75)", fontSize: 12.5 },
  heroCta: {
    backgroundColor: "#fff",
    borderRadius: radius.pill,
    paddingVertical: 13,
    alignItems: "center",
  },
  heroCtaText: { color: colors.primaryDark, fontWeight: "800", fontSize: 15 },
  heroFoot: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 10,
  },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: spacing.xl },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    ...shadows.card,
  },
  statAccent: { backgroundColor: colors.accentSoft, borderColor: "#FDE68A" },
  statValue: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 2, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  editText: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 },

  catRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  catEmoji: { fontSize: 16 },
  catName: { fontSize: 14, fontWeight: "800", color: colors.text, flex: 1, letterSpacing: -0.1 },
  catCount: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
  },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "47.8%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 13,
    minHeight: 112,
    ...shadows.card,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tileEmoji: { fontSize: 19 },
  tileDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  tileName: {
    fontSize: 14.5,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  tileDesc: { fontSize: 11.5, color: colors.textMuted, lineHeight: 16 },

  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.text, marginBottom: 6 },

  footerNote: {
    marginTop: spacing.sm,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  footerNoteText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    fontWeight: "600",
  },
});
