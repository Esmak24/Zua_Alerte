import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "zua_alerte_access_token";

async function webGetItem(key: string): Promise<string | null> {
  if (typeof localStorage === "undefined") {
    return null;
  }

  return localStorage.getItem(key);
}

async function webSetItem(key: string, value: string): Promise<void> {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(key, value);
}

async function webDeleteItem(key: string): Promise<void> {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(key);
}

export async function getAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return webGetItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setAccessToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    await webSetItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAccessToken(): Promise<void> {
  if (Platform.OS === "web") {
    await webDeleteItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
