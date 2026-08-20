import { Platform } from "react-native";

import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./authStorage";

/**
 * Web (même PC) → loopback : http://127.0.0.1:8002
 *   L'IP LAN du .env (ex. 10.20.20.214) peut être obsolète et provoque
 *   un AbortError / "Le serveur met trop de temps à répondre".
 * Android / iOS → EXPO_PUBLIC_API_URL ou IP LAN (conservée pour le device).
 */
const API_BASE_URL =
  Platform.OS === "web"
    ? "http://127.0.0.1:8002"
    : (process.env.EXPO_PUBLIC_API_URL ?? "http://10.20.20.214:8002");

if (__DEV__) {
  console.log("[Zua Alerte] API_BASE_URL =", API_BASE_URL);
}

export type Alert = {
  id: number;
  device_id: number;
  gadget_id: string | null;
  type: string;
  status: string;
  latitude: number;
  longitude: number;
  message: string | null;
  timestamp: string;
  received_at: string;
  triggered_by: string | null;
};

export const MVP_DEVICE_ID = "GADGET_001";

export type AuthUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

function readDetailMessage(body: unknown, fallback: string): string {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }

  return fallback;
}

/** Messages réseau lisibles (évite "Failed to fetch" / TypeError bruts). */
export function toUserFacingApiError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.name === "AbortError") {
    return "Le serveur met trop de temps à répondre. Vérifiez que le backend est démarré.";
  }

  const lower = error.message.toLowerCase();

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network request failed") ||
    lower.includes("networkerror") ||
    error instanceof TypeError
  ) {
    return "Impossible de contacter le serveur. Vérifiez que le backend est démarré sur le port 8002.";
  }

  return error.message || fallback;
}

export type UserDevice = {
  user_id: number;
  user_full_name: string;
  has_device: boolean;
  gadget_id: string | null;
  device_internal_id: number | null;
  device_name: string | null;
  assignment_id: number | null;
  message: string | null;
};

export type CreateAlertPayload = {
  device_id: string;
  type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export type CreateAlertResponse = {
  message: string;
  alert_id: number;
  device_id: string;
  type: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  triggered_by: string | null;
  notifications_queued?: number;
  notification_delivery?: string;
};

export function getTriggererName(alert: Alert): string {
  if (alert.triggered_by && alert.triggered_by.trim()) {
    return alert.triggered_by;
  }

  return "Déclencheur non identifié";
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function parseTimestamp(value: string): Date | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function formatAlertDate(timestamp: string): string {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return "Date inconnue";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

export function formatAlertDateLong(timestamp: string): string {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return "Date inconnue";
  }

  return `${date.getDate()} ${MONTHS_FR[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatAlertTime(timestamp: string): string {
  const date = parseTimestamp(timestamp);

  if (!date) {
    return "--:--";
  }

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function sortAlertsNewestFirst(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const timeA = parseTimestamp(a.timestamp)?.getTime() ?? 0;
    const timeB = parseTimestamp(b.timestamp)?.getTime() ?? 0;

    return timeB - timeA;
  });
}

export async function getAlerts(): Promise<Alert[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/alerts`, {
      method: "GET",
      headers: await authHeaders(),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de récupérer les alertes.")
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("Réponse API invalide.");
    }

    return data as Alert[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("API inaccessible.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getUserDevice(userId: number): Promise<UserDevice> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/users/${userId}/device`,
      {
        method: "GET",
        headers: await authHeaders(),
        signal: controller.signal,
      }
    );

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      if (
        data &&
        typeof data === "object" &&
        "detail" in data &&
        typeof data.detail === "string"
      ) {
        throw new Error(data.detail);
      }

      throw new Error("Impossible de récupérer le gadget.");
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("has_device" in data) ||
      typeof data.has_device !== "boolean"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as UserDevice;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de récupérer le gadget.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AssignmentResponse = {
  message: string;
  assignment_id: number;
  user_id: number;
  user_full_name: string;
  gadget_id: string;
  device_internal_id: number;
  is_active: boolean;
  assigned_at: string;
  created: boolean;
};

export async function assignDevice(
  userId: number,
  gadgetId: string
): Promise<AssignmentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/assignments`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        // Conservé pour compatibilité ; le backend utilise le JWT.
        user_id: userId,
        gadget_id: gadgetId,
      }),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      if (
        data &&
        typeof data === "object" &&
        "detail" in data &&
        typeof data.detail === "string"
      ) {
        throw new Error(data.detail);
      }

      if (response.status === 404) {
        throw new Error("Gadget introuvable.");
      }

      if (response.status === 409) {
        throw new Error("Ce gadget est déjà associé à un autre utilisateur.");
      }

      throw new Error("Impossible de contacter le serveur.");
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("gadget_id" in data) ||
      typeof data.gadget_id !== "string"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as AssignmentResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof TypeError) {
      throw new Error("Impossible de contacter le serveur.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de contacter le serveur.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function assignDemoDevice(): Promise<AssignmentResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/assignments/demo`, {
      method: "POST",
      headers: await authHeaders(),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(
          data,
          "Impossible d'associer le gadget de démonstration."
        )
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("gadget_id" in data) ||
      typeof data.gadget_id !== "string"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as AssignmentResponse;
  } catch (error) {
    throw new Error(
      toUserFacingApiError(
        error,
        "Impossible d'associer le gadget de démonstration."
      )
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

function readApiErrorMessage(status: number, body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }

  if (status === 404) {
    return "Gadget introuvable.";
  }

  if (status === 400) {
    return "Données de l'alerte invalides.";
  }

  if (status >= 500) {
    return "Erreur serveur. Réessayez plus tard.";
  }

  return "Impossible d'envoyer l'alerte. Vérifiez votre connexion.";
}

export async function createAlert(
  payload: CreateAlertPayload
): Promise<CreateAlertResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/alerts`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(readApiErrorMessage(response.status, data));
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("alert_id" in data) ||
      typeof data.alert_id !== "number"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as CreateAlertResponse;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible d'envoyer l'alerte. Vérifiez votre connexion.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function registerUser(payload: {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<AuthResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        readDetailMessage(data, "Impossible de créer le compte.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("access_token" in data) ||
      typeof data.access_token !== "string" ||
      !("user" in data)
    ) {
      throw new Error("Réponse API invalide.");
    }

    const auth = data as AuthResponse;
    await setAccessToken(auth.access_token);
    return auth;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de créer le compte.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        readDetailMessage(data, "Email ou mot de passe incorrect.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("access_token" in data) ||
      typeof data.access_token !== "string" ||
      !("user" in data)
    ) {
      throw new Error("Réponse API invalide.");
    }

    const auth = data as AuthResponse;
    await setAccessToken(auth.access_token);
    return auth;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de se connecter.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Non authentifié.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de récupérer le profil.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("id" in data) ||
      typeof data.id !== "number"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as AuthUser;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de récupérer le profil.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function updateProfile(payload: {
  full_name?: string;
  phone?: string;
}): Promise<AuthUser> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de mettre à jour le profil.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("id" in data) ||
      typeof data.id !== "number"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as AuthUser;
  } catch (error) {
    throw new Error(
      toUserFacingApiError(error, "Impossible de mettre à jour le profil.")
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export type AppNotification = {
  id: number;
  user_id: number;
  alert_id: number | null;
  title: string;
  body: string;
  type: string;
  status: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/notifications`, {
      method: "GET",
      headers: await authHeaders(),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de récupérer les notifications.")
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("Réponse API invalide.");
    }

    return data as AppNotification[];
  } catch (error) {
    throw new Error(
      toUserFacingApiError(
        error,
        "Impossible de récupérer les notifications."
      )
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function logoutUser(): Promise<void> {
  const token = await getAccessToken();

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // La déconnexion locale reste prioritaire.
    }
  }

  await clearAccessToken();
}

export type PublicUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
};

export type UserReference = {
  id: number;
  user_id: number;
  reference_user_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
};

async function authHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("Non authentifié.");
  }

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function searchUserByEmail(email: string): Promise<PublicUser> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const query = encodeURIComponent(email.trim());
    const response = await fetch(
      `${API_BASE_URL}/api/v1/users/search?email=${query}`,
      {
        method: "GET",
        headers: await authHeaders(),
        signal: controller.signal,
      }
    );

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de trouver cet utilisateur.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("id" in data) ||
      typeof data.id !== "number"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as PublicUser;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de trouver cet utilisateur.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getReferences(): Promise<UserReference[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/references`, {
      method: "GET",
      headers: await authHeaders(),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de récupérer les références.")
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("Réponse API invalide.");
    }

    return data as UserReference[];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de récupérer les références.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function addReference(
  referenceUserId: number
): Promise<UserReference> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/references`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ reference_user_id: referenceUserId }),
      signal: controller.signal,
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible d'ajouter cette personne.")
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      !("id" in data) ||
      typeof data.id !== "number"
    ) {
      throw new Error("Réponse API invalide.");
    }

    return data as UserReference;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible d'ajouter cette personne.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function deleteReference(referenceId: number): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/references/${referenceId}`,
      {
        method: "DELETE",
        headers: await authHeaders(),
        signal: controller.signal,
      }
    );

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      if (response.status === 401) {
        await clearAccessToken();
      }

      throw new Error(
        readDetailMessage(data, "Impossible de retirer cette personne.")
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Impossible de retirer cette personne.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export { getAccessToken, clearAccessToken };
