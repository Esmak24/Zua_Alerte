import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "../components/ScreenHeader";
import {
  Alert,
  formatAlertDateLong,
  formatAlertTime,
  getAlerts,
  getTriggererName,
} from "../services/api";
import { colors, radius, shadow } from "../theme";

export default function AlertScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlert = useCallback(async () => {
    if (!id) {
      setError("Aucune alerte sélectionnée.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const alerts = await getAlerts();
      const found = alerts.find((item) => String(item.id) === String(id));

      if (!found) {
        setError("Alerte introuvable.");
        setAlert(null);
        return;
      }

      setAlert(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API inaccessible.");
      setAlert(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  const openMap = () => {
    if (!alert) {
      return;
    }

    router.push({
      pathname: "/map",
      params: {
        id: String(alert.id),
        latitude: String(alert.latitude),
        longitude: String(alert.longitude),
        timestamp: alert.timestamp,
        type: alert.type,
        triggered_by: getTriggererName(alert),
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !alert) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.error}>{error ?? "Alerte introuvable."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasCoordinates =
    typeof alert.latitude === "number" &&
    typeof alert.longitude === "number" &&
    !Number.isNaN(alert.latitude) &&
    !Number.isNaN(alert.longitude);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Détail de l'alerte" />

        <View style={styles.alertHeader}>
          <View style={styles.sosBadge}>
            <View style={styles.sosDot} />
            <Text style={styles.sosBadgeText}>SOS</Text>
          </View>
          <Text style={styles.alertTitle}>Alerte SOS</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Identifiant alerte</Text>
          <Text style={styles.value}>#{alert.id}</Text>

          <Text style={styles.label}>Déclenchée par</Text>
          <Text style={styles.name}>{getTriggererName(alert)}</Text>

          <View style={styles.separator} />

          <Text style={styles.label}>Statut</Text>
          <Text style={styles.value}>{alert.status}</Text>

          <Text style={styles.label}>Type</Text>
          <Text style={styles.value}>{alert.type}</Text>

          <Text style={styles.label}>Gadget</Text>
          <Text style={styles.value}>{alert.gadget_id ?? "—"}</Text>

          <View style={styles.separator} />

          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{formatAlertDateLong(alert.timestamp)}</Text>

          <Text style={styles.label}>Heure</Text>
          <Text style={styles.value}>{formatAlertTime(alert.timestamp)}</Text>

          <View style={styles.locationBox}>
            <View style={styles.locationTitleRow}>
              <Ionicons
                name="location-outline"
                size={16}
                color={hasCoordinates ? colors.primary : colors.textMuted}
              />
              <Text style={styles.locationTitle}>
                {hasCoordinates
                  ? "Localisation disponible"
                  : "Localisation indisponible"}
              </Text>
            </View>

            <Text style={styles.coordinates}>
              Latitude : {hasCoordinates ? alert.latitude : "—"}
            </Text>

            <Text style={styles.coordinates}>
              Longitude : {hasCoordinates ? alert.longitude : "—"}
            </Text>
          </View>

          <View style={styles.messageBox}>
            <Text style={styles.label}>Message</Text>
            <Text style={styles.message}>
              {alert.message ?? "Alerte SOS déclenchée."}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.mapButton, !hasCoordinates && styles.buttonDisabled]}
          onPress={openMap}
          disabled={!hasCoordinates}
        >
          <Ionicons name="map-outline" size={18} color="#FFFFFF" />
          <Text style={styles.mapButtonText}>VOIR LA CARTE</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  error: {
    color: colors.error,
    fontSize: 16,
    textAlign: "center",
  },
  alertHeader: {
    marginBottom: 16,
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
    marginBottom: 8,
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
  alertTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    ...shadow.card,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 18,
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 18,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 20,
  },
  locationBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 16,
    marginTop: 5,
    marginBottom: 18,
  },
  locationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  coordinates: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 5,
  },
  messageBox: {
    marginTop: 5,
  },
  message: {
    fontSize: 16,
    color: colors.text,
  },
  mapButton: {
    backgroundColor: colors.text,
    paddingVertical: 16,
    borderRadius: radius.md,
    alignItems: "center",
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  mapButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
