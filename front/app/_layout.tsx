import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { getAccessToken, getCurrentUser } from "../services/api";
import { registerForPushNotificationsAsync } from "../services/notificationService";
import { colors } from "../theme";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const authRoute =
        segments[0] === "login" || segments[0] === "register";

      try {
        const token = await getAccessToken();

        if (!token) {
          if (!authRoute) {
            router.replace("/login");
          }
        } else {
          await getCurrentUser();
          void registerForPushNotificationsAsync();
          if (authRoute) {
            router.replace("/");
          }
        }
      } catch {
        if (!authRoute) {
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [segments, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {!ready ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
