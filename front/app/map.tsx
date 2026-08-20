import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "../components/ScreenHeader";
import { SosMap } from "../components/sos-map";
import { formatAlertDateLong, formatAlertTime } from "../services/api";
import { colors, radius } from "../theme";

export default function MapScreen() {
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    timestamp?: string;
    type?: string;
    triggered_by?: string;
  }>();

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  const triggererName =
    params.triggered_by && params.triggered_by.trim()
      ? params.triggered_by
      : "Déclencheur non identifié";

  const timestamp = params.timestamp ?? "";
  const alertType = params.type ?? "SOS";

  const openGoogleMaps = () => {
    if (!hasCoordinates) {
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  if (!hasCoordinates) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.missing}>
          <ScreenHeader title="Localisation" />
          <Text style={styles.missingText}>
            Coordonnées absentes pour cette alerte.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <ScreenHeader title="Localisation SOS" />
      </View>

      <View style={styles.mapContainer}>
        <SosMap
          latitude={latitude}
          longitude={longitude}
          title={triggererName}
          description={alertType}
        />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.sosBadge}>
          <View style={styles.sosDot} />
          <Text style={styles.sosBadgeText}>{alertType}</Text>
        </View>

        <Text style={styles.name}>{triggererName}</Text>

        <Text style={styles.info}>
          Date : {formatAlertDateLong(timestamp)}
        </Text>
        <Text style={styles.info}>Heure : {formatAlertTime(timestamp)}</Text>
        <Text style={styles.coordinates}>Latitude : {latitude}</Text>
        <Text style={styles.coordinates}>Longitude : {longitude}</Text>

        <TouchableOpacity style={styles.button} onPress={openGoogleMaps}>
          <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>OUVRIR DANS GOOGLE MAPS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  mapContainer: {
    flex: 1,
  },
  missing: {
    flex: 1,
    padding: 20,
  },
  missingText: {
    color: colors.error,
    fontSize: 16,
    textAlign: "center",
    marginTop: 24,
  },
  infoCard: {
    backgroundColor: colors.surface,
    padding: 20,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    elevation: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  sosBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
  },
  sosDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  sosBadgeText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 11,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  info: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  coordinates: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  button: {
    backgroundColor: colors.text,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
