import * as Location from "expo-location";
import { Platform } from "react-native";

export type SosCoordinates = {
  latitude: number;
  longitude: number;
};

function mapLocationError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(
      "Localisation indisponible. L'alerte n'a pas été envoyée."
    );
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("denied") ||
    message.includes("permission") ||
    message.includes("refus")
  ) {
    return new Error(
      "Localisation refusée. Autorisez la position dans le navigateur pour envoyer un SOS."
    );
  }

  if (message.includes("timeout") || message.includes("timed out")) {
    return new Error(
      "Délai dépassé pour obtenir la position GPS. Réessayez près d'une fenêtre ou avec le Wi‑Fi."
    );
  }

  if (
    message.includes("unavailable") ||
    message.includes("position") ||
    message.includes("location")
  ) {
    return new Error(
      "Position GPS indisponible pour le moment. Réessayez dans quelques secondes."
    );
  }

  return new Error(error.message);
}

/**
 * Récupère la position réelle (expo-location / navigator.geolocation sur Web).
 * Aucune coordonnée fictive.
 */
export async function getSosCoordinates(): Promise<SosCoordinates> {
  if (Platform.OS === "web") {
    const nav =
      typeof navigator !== "undefined" ? navigator.geolocation : undefined;

    if (!nav) {
      throw new Error(
        "Ce navigateur ne prend pas en charge la géolocalisation."
      );
    }
  }

  const permission = await Location.requestForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    throw new Error(
      "Localisation refusée. Autorisez la position pour envoyer une alerte SOS."
    );
  }

  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("timeout obtaining location")),
          20000
        );
      }),
    ]);

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(
        "Localisation indisponible. L'alerte n'a pas été envoyée."
      );
    }

    return { latitude, longitude };
  } catch (error) {
    throw mapLocationError(error);
  }
}
