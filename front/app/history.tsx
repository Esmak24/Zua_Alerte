import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { AppNavBar } from "../components/AppNavBar";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  Alert,
  formatAlertDate,
  formatAlertTime,
  getAlerts,
  getTriggererName,
  sortAlertsNewestFirst,
} from "../services/api";
import { colors, radius, shadow } from "../theme";

export default function HistoryScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await getAlerts();
      setAlerts(sortAlertsNewestFirst(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "API inaccessible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.body}>
        <FlatList
          data={alerts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAlerts(true)}
            />
          }
          ListHeaderComponent={
            <>
              <ScreenHeader
                title="Historique"
                subtitle="Consultez les anciennes alertes SOS."
              />

              {loading ? (
                <ActivityIndicator color={colors.primary} style={styles.loader} />
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          }
          ListEmptyComponent={
            loading || error ? null : (
              <Text style={styles.empty}>Aucune alerte enregistrée.</Text>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.alertCard}
              onPress={() =>
                router.push({
                  pathname: "/alert",
                  params: { id: String(item.id) },
                })
              }
            >
              <View style={styles.sosBadge}>
                <View style={styles.sosDot} />
                <Text style={styles.sosBadgeText}>{item.type}</Text>
              </View>
              <Text style={styles.name}>{getTriggererName(item)}</Text>
              <Text style={styles.date}>
                {formatAlertDate(item.timestamp)} ·{" "}
                {formatAlertTime(item.timestamp)}
              </Text>
              <Text style={styles.meta}>
                {item.status}
                {item.gadget_id ? ` · ${item.gadget_id}` : ""}
              </Text>
              <Text style={styles.meta}>
                {Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
                  ? `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
                  : "Localisation indisponible"}
              </Text>
              <View style={styles.seeRow}>
                <Text style={styles.seeText}>Voir</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.primary}
                />
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
      <AppNavBar active="history" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  loader: {
    marginBottom: 20,
  },
  error: {
    color: colors.error,
    fontSize: 15,
    marginBottom: 20,
  },
  empty: {
    fontSize: 16,
    color: colors.textMuted,
  },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: colors.textMuted,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  seeRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});
