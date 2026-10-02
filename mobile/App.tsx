import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "./src/store/auth";
import RegisterScreen from "./src/screens/RegisterScreen";
import LoginScreen from "./src/screens/LoginScreen";
import VerifyScreen from "./src/screens/VerifyScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import TasksScreen from "./src/screens/TasksScreen";
import HomeScreen from "./src/screens/HomeScreen";
import { api } from "./src/api/client";
import { colors } from "./src/theme/colors";
import { RootStackParamList } from "./src/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Verify" component={VerifyScreen} />
    </Stack.Navigator>
  );
}

function AppShell() {
  const { token, user } = useAuth();
  const [hasSelections, setHasSelections] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);

  const checkSelections = useCallback(async () => {
    if (!user?.profileComplete) {
      setHasSelections(null);
      return;
    }
    try {
      const data = await api<{ tasks: unknown[] }>("/api/tasks/selections", { token });
      setHasSelections(data.tasks.length > 0);
    } catch {
      setHasSelections(false);
    }
  }, [token, user?.profileComplete]);

  useEffect(() => {
    checkSelections();
  }, [checkSelections]);

  if (!user) return null;
  if (!user.profileComplete) return <ProfileScreen />;

  if (hasSelections === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (editing || !hasSelections) {
    return (
      <TasksScreen
        onDone={() => {
          setEditing(false);
          setHasSelections(true);
        }}
      />
    );
  }

  return <HomeScreen onEditTasks={() => setEditing(true)} />;
}

function Gate() {
  const { loading, user } = useAuth();
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return user ? <AppShell /> : <AuthStack />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
          <NavigationContainer>
            <StatusBar style="dark" />
            <Gate />
          </NavigationContainer>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
});
