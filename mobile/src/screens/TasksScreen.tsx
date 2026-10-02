import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Banner, BrandRow, Button, H1, Muted, Screen, Stepper } from "../components/ui";
import { api, ApiRequestError } from "../api/client";
import { useAuth } from "../store/auth";
import { CATEGORY_EMOJI, colors, radius, shadows, spacing } from "../theme/colors";

type Task = { id: string; slug: string; name: string; description: string };
type Category = { id: string; slug: string; name: string; tasks: Task[] };

export default function TasksScreen({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [cat, mine] = await Promise.all([
          api<{ categories: Category[] }>("/api/tasks/catalogue"),
          api<{ tasks: Task[] }>("/api/tasks/selections", { token }),
        ]);
        setCategories(cat.categories);
        setSelected(new Set(mine.tasks.map((t) => t.id)));
      } catch (e) {
        if (e instanceof ApiRequestError) setErr(e.message);
        else setErr("Couldn't load tasks.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((c) => ({
        ...c,
        tasks: c.tasks.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.tasks.length > 0);
  }, [categories, query]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const onSave = async () => {
    if (selected.size === 0) {
      setErr("Pick at least one task so we know how to help.");
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      await api("/api/tasks/selections", {
        method: "PUT",
        token,
        body: { taskIds: [...selected] },
      });
      onDone();
    } catch (e) {
      if (e instanceof ApiRequestError) setErr(e.message);
      else setErr("Couldn't save selections.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  const count = selected.size;

  return (
    <Screen>
      <BrandRow />
      <Stepper step={4} total={4} />
      <H1>What should we take off your plate?</H1>
      <Muted style={{ marginBottom: spacing.md }}>
        Pick everything you'd like handled. You can change this anytime.
      </Muted>
      {err ? <Banner>{err}</Banner> : null}

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search 20+ tasks"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={10}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {filtered.length === 0 ? (
        <View style={{ padding: spacing.lg, alignItems: "center" }}>
          <Muted>No matches for "{query}".</Muted>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={{ marginBottom: spacing.lg }}>
              <View style={styles.catRow}>
                <Text style={styles.catEmoji}>{CATEGORY_EMOJI[item.slug] ?? "✨"}</Text>
                <Text style={styles.catName}>{item.name}</Text>
                <Text style={styles.catCount}>
                  {item.tasks.filter((t) => selected.has(t.id)).length}/{item.tasks.length}
                </Text>
              </View>
              {item.tasks.map((t) => {
                const on = selected.has(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggle(t.id)}
                    style={({ pressed }) => [
                      styles.card,
                      on ? styles.cardOn : null,
                      pressed ? { transform: [{ scale: 0.995 }] } : null,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.taskName}>{t.name}</Text>
                      <Text style={styles.taskDesc}>{t.description}</Text>
                    </View>
                    <View style={[styles.check, on ? styles.checkOn : null]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <Button
            title={
              count === 0
                ? "Pick at least one task"
                : `Confirm ${count} task${count === 1 ? "" : "s"}`
            }
            onPress={onSave}
            loading={saving}
            disabled={count === 0}
            size="lg"
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  searchClear: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: 6,
  },

  catRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
    gap: 8,
  },
  catEmoji: { fontSize: 18 },
  catName: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.1,
    flex: 1,
  },
  catCount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1.25,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  cardOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  taskName: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  taskDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  checkOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: { color: "white", fontWeight: "900", fontSize: 14 },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.card,
  },
  footerInner: {},
});
