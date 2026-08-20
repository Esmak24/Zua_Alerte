import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getAccessToken } from "./api";

// Même règle que api.ts : Web → loopback, natif → LAN / .env
const API_BASE_URL =
  Platform.OS === "web"
    ? "http://127.0.0.1:8002"
    : (process.env.EXPO_PUBLIC_API_URL ?? "http://10.20.20.214:8002");

function getExpoProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId
  );
}

async function sendTokenToBackend(
  token: string,
  platform: string,
  deviceName: string | null
): Promise<void> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/notification-tokens`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token,
      platform,
      device_name: deviceName,
    }),
  });

  if (!response.ok) {
    console.log(
      "[Zua Alerte] Enregistrement du token de notification refusé par l'API."
    );
  }
}

export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      console.log(
        "[Zua Alerte] Notifications: ignorées sur le web (push natif indisponible)."
      );
      return;
    }

    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      console.log(
        "[Zua Alerte] Notifications: plateforme non supportée pour le MVP."
      );
      return;
    }

    if (!Device.isDevice) {
      console.log(
        "[Zua Alerte] Notifications: simulateur/émulateur — token non demandé."
      );
      return;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("zua-alerte-sos", {
        name: "Alertes SOS",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;

    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }

    if (status !== "granted") {
      console.log(
        "[Zua Alerte] Notifications: permission refusée — connexion inchangée."
      );
      return;
    }

    const projectId = getExpoProjectId();
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const expoToken = tokenResponse.data?.trim();

    if (!expoToken) {
      console.log("[Zua Alerte] Notifications: token Expo introuvable.");
      return;
    }

    await sendTokenToBackend(
      expoToken,
      Platform.OS,
      Device.modelName ?? Device.deviceName ?? null
    );
  } catch (error) {
    console.log(
      "[Zua Alerte] Notifications: enregistrement ignoré.",
      error instanceof Error ? error.message : ""
    );
  }
}
