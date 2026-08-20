import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AppNavBar } from "../components/AppNavBar";
import { colors, radius, shadow } from "../theme";

import {
  Alert,
  assignDemoDevice,
  assignDevice,
  AuthUser,
  createAlert,
  CreateAlertResponse,
  formatAlertDate,
  formatAlertTime,
  getAlerts,
  getCurrentUser,
  getTriggererName,
  getUserDevice,
  logoutUser,
  sortAlertsNewestFirst,
  toUserFacingApiError,
  UserDevice,
} from "../services/api";
import { getSosCoordinates } from "../services/locationService";

export default function HomeScreen() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingSOS, setSendingSOS] = useState(false);
  const sendingSOSRef = useRef(false);
  const [userDevice, setUserDevice] = useState<UserDevice | null>(null);
  const [gadgetLoading, setGadgetLoading] = useState(true);
  const [gadgetError, setGadgetError] = useState<string | null>(null);
  const [gadgetInput, setGadgetInput] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [sosSuccess, setSosSuccess] = useState<CreateAlertResponse | null>(
    null
  );
  const [sosError, setSosError] = useState<string | null>(null);
  const [sosConfirmVisible, setSosConfirmVisible] = useState(false);
  const gadgetSectionRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadLatestAlert = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const alerts = sortAlertsNewestFirst(await getAlerts());
      setLatestAlert(alerts[0] ?? null);
    } catch (err) {
      setLatestAlert(null);
      setError(err instanceof Error ? err.message : "API inaccessible.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserDevice = useCallback(async (userId: number) => {
    setGadgetLoading(true);
    setGadgetError(null);

    try {
      const device = await getUserDevice(userId);
      setUserDevice(device);
    } catch (err) {
      setUserDevice(null);
      setGadgetError(
        err instanceof Error
          ? err.message
          : "Impossible de récupérer le gadget."
      );
    } finally {
      setGadgetLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setAuthLoading(true);

      try {
        const user = await getCurrentUser();
        if (cancelled) {
          return;
        }

        setCurrentUser(user);
        await Promise.all([loadLatestAlert(), loadUserDevice(user.id)]);
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          router.replace("/login");
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadLatestAlert, loadUserDevice]);

  const handleAssignGadget = useCallback(async () => {
    if (!currentUser) {
      setAssignError("Connectez-vous pour associer un gadget.");
      return;
    }

    const gadgetId = gadgetInput.trim();

    if (!gadgetId) {
      setAssignError("Saisissez l'identifiant du gadget.");
      setAssignMessage(null);
      return;
    }

    if (assigning) {
      return;
    }

    setAssigning(true);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const result = await assignDevice(currentUser.id, gadgetId);

      if (result.created) {
        setAssignMessage("Gadget associé avec succès.");
      } else {
        setAssignMessage(result.message || "Gadget associé avec succès.");
      }

      setGadgetInput("");
      setSosError(null);
      await loadUserDevice(currentUser.id);
    } catch (err) {
      setAssignMessage(null);
      setAssignError(
        toUserFacingApiError(err, "Impossible de contacter le serveur.")
      );
    } finally {
      setAssigning(false);
    }
  }, [assigning, currentUser, gadgetInput, loadUserDevice]);

  const scrollToGadgetSection = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  const handleAssignDemoGadget = useCallback(async () => {
    if (!currentUser) {
      setAssignError("Connectez-vous pour associer un gadget.");
      return;
    }

    if (assigning) {
      return;
    }

    setAssigning(true);
    setAssignError(null);
    setAssignMessage(null);

    try {
      const result = await assignDemoDevice();
      setAssignMessage(
        result.message ||
          `Gadget de démonstration associé : ${result.gadget_id}`
      );
      setSosError(null);
      await loadUserDevice(currentUser.id);
    } catch (err) {
      setAssignMessage(null);
      setAssignError(
        toUserFacingApiError(
          err,
          "Impossible d'associer le gadget de démonstration."
        )
      );
    } finally {
      setAssigning(false);
    }
  }, [assigning, currentUser, loadUserDevice]);

  const sendSOS = useCallback(async () => {
    if (sendingSOSRef.current) {
      return;
    }

    if (!currentUser) {
      setSosError("Connectez-vous pour déclencher une alerte SOS.");
      return;
    }

    sendingSOSRef.current = true;
    setSendingSOS(true);
    setSosSuccess(null);
    setSosError(null);

    try {
      let associatedDevice: UserDevice;

      try {
        associatedDevice = await getUserDevice(currentUser.id);
        setUserDevice(associatedDevice);
      } catch (err) {
        throw new Error(
          toUserFacingApiError(err, "Impossible de récupérer votre gadget.")
        );
      }

      if (!associatedDevice.has_device || !associatedDevice.gadget_id) {
        scrollToGadgetSection();
        throw new Error(
          "Aucun gadget associé. Utilisez « Associer le gadget de démonstration » ci-dessous, puis réessayez le SOS."
        );
      }

      const deviceId = associatedDevice.gadget_id;
      const { latitude, longitude } = await getSosCoordinates();

      const created = await createAlert({
        device_id: deviceId,
        type: "SOS",
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });

      setSosSuccess(created);
      await loadLatestAlert();
    } catch (err) {
      setSosSuccess(null);
      setSosError(
        toUserFacingApiError(err, "Impossible d'envoyer l'alerte.")
      );
    } finally {
      sendingSOSRef.current = false;
      setSendingSOS(false);
    }
  }, [currentUser, loadLatestAlert, scrollToGadgetSection]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setCurrentUser(null);
    router.replace("/login");
  }, []);

  const openSosConfirm = () => {
    if (sendingSOS) {
      return;
    }

    setSosConfirmVisible(true);
  };

  const cancelSosConfirm = () => {
    setSosConfirmVisible(false);
  };

  const confirmAndSendSos = () => {
    if (sendingSOS) {
      return;
    }

    setSosConfirmVisible(false);
    void sendSOS();
  };

  const openLatestAlertMap = () => {
    if (!latestAlert) {
      return;
    }

    router.push({
      pathname: "/map",
      params: {
        id: String(latestAlert.id),
        latitude: String(latestAlert.latitude),
        longitude: String(latestAlert.longitude),
        timestamp: latestAlert.timestamp,
        type: latestAlert.type,
        triggered_by: getTriggererName(latestAlert),
      },
    });
  };

  if (authLoading || !currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authLoading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.muted}>Chargement de la session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const gadgetAssociated = Boolean(
    userDevice?.has_device && userDevice.gadget_id
  );

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={sosConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelSosConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning" size={28} color={colors.primary} />
            </View>
            <Text style={styles.modalTitle}>Déclencher une alerte SOS ?</Text>
            <Text style={styles.modalMessage}>
              Votre position sera envoyée à vos personnes de référence.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cancelSosConfirm}
              >
                <Text style={styles.modalCancelText}>ANNULER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSendButton}
                onPress={confirmAndSendSos}
              >
                <Text style={styles.modalSendText}>ENVOYER L'ALERTE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Zua Alerte</Text>
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <Text style={styles.userName}>{currentUser.full_name}</Text>
              <Text style={styles.profileLink}>Mon profil →</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.logoutChip}
            onPress={() => void handleLogout()}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sosWrap}>
          <View style={styles.sosHalo} />
          <TouchableOpacity
            style={[styles.sosButton, sendingSOS && styles.sosButtonDisabled]}
            onPress={openSosConfirm}
            disabled={sendingSOS}
            accessibilityRole="button"
            accessibilityLabel="Déclencher une alerte SOS"
          >
            {sendingSOS ? (
              <ActivityIndicator color="#FFFFFF" size="large" />
            ) : (
              <Text style={styles.sosButtonText}>SOS</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.sosHint}>
            {sendingSOS ? "Envoi de l'alerte..." : "Appuyer pour alerter"}
          </Text>
        </View>

        {sosSuccess ? (
          <View style={styles.sosFeedbackSuccess}>
            <Text style={styles.sosFeedbackTitle}>Alerte SOS envoyée</Text>
            {sosSuccess.timestamp ? (
              <Text style={styles.sosFeedbackLine}>
                Heure : {formatAlertTime(String(sosSuccess.timestamp))}
              </Text>
            ) : null}
            {sosSuccess.device_id ? (
              <Text style={styles.sosFeedbackLine}>
                Gadget : {sosSuccess.device_id}
              </Text>
            ) : null}
            {typeof sosSuccess.alert_id === "number" ? (
              <Text style={styles.sosFeedbackLine}>
                Alerte n° {sosSuccess.alert_id}
              </Text>
            ) : null}
            <Text style={styles.sosFeedbackLine}>
              Notifications :{" "}
              {typeof sosSuccess.notifications_queued === "number"
                ? `${sosSuccess.notifications_queued} enregistrée(s) pour vos personnes de référence`
                : "enregistrées côté serveur"}{" "}
              (envoi push réel non activé en MVP).
            </Text>
            <TouchableOpacity
              style={styles.sosFeedbackAction}
              onPress={() =>
                router.push({
                  pathname: "/alert",
                  params: { id: String(sosSuccess.alert_id) },
                })
              }
            >
              <Text style={styles.sosFeedbackActionText}>Voir l'alerte</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {sosError ? (
          <View style={styles.sosFeedbackError}>
            <Text style={styles.sosFeedbackTitleError}>
              Impossible d'envoyer l'alerte.
            </Text>
            <Text style={styles.sosFeedbackLineError}>{sosError}</Text>
            {sosError.toLowerCase().includes("gadget") ? (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={scrollToGadgetSection}
              >
                <Text style={styles.retryButtonText}>Aller à Mon gadget</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={openSosConfirm}
                disabled={sendingSOS}
              >
                <Text style={styles.retryButtonText}>Réessayer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/contacts")}
          >
            <Ionicons name="people-outline" size={22} color={colors.primary} />
            <Text style={styles.gridLabel}>Mes contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            <Ionicons name="watch-outline" size={22} color={colors.primary} />
            <Text style={styles.gridLabel}>Mon gadget</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/history")}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
            <Text style={styles.gridLabel}>Historique</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.gridCard, !latestAlert && styles.gridCardDisabled]}
            onPress={openLatestAlertMap}
            disabled={!latestAlert}
          >
            <Ionicons name="location-outline" size={22} color={colors.primary} />
            <Text style={styles.gridLabel}>Localisation</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dernière alerte</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : latestAlert ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/alert",
                  params: { id: String(latestAlert.id) },
                })
              }
            >
              <View style={styles.badgeRow}>
                <View style={styles.sosBadge}>
                  <Text style={styles.sosBadgeText}>SOS</Text>
                </View>
              </View>
              <Text style={styles.alertMeta}>
                {formatAlertDate(latestAlert.timestamp)} ·{" "}
                {formatAlertTime(latestAlert.timestamp)}
              </Text>
              <Text style={styles.alertName}>
                {getTriggererName(latestAlert)}
              </Text>
              {latestAlert.gadget_id ? (
                <Text style={styles.alertGadget}>{latestAlert.gadget_id}</Text>
              ) : null}
              <Text style={styles.cardLink}>Voir la localisation →</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.muted}>Aucune alerte</Text>
          )}
        </View>

        <View ref={gadgetSectionRef} style={styles.card}>
          <View style={styles.gadgetHeader}>
            <Text style={styles.sectionTitle}>Mon gadget</Text>
            <View
              style={[
                styles.statusDot,
                !gadgetAssociated && styles.statusDotOff,
              ]}
            />
          </View>

          {gadgetLoading ? (
            <>
              <ActivityIndicator color={colors.success} style={styles.loader} />
              <Text style={styles.muted}>Chargement du gadget...</Text>
            </>
          ) : gadgetError ? (
            <Text style={styles.error}>Impossible de récupérer le gadget.</Text>
          ) : gadgetAssociated ? (
            <>
              <Text style={styles.gadgetName}>{userDevice?.gadget_id}</Text>
              {userDevice?.device_name ? (
                <Text style={styles.muted}>{userDevice.device_name}</Text>
              ) : null}
              <Text style={styles.successText}>Gadget associé · actif</Text>
            </>
          ) : (
            <>
              <Text style={styles.muted}>Aucun gadget associé</Text>
              <Text style={styles.demoHint}>
                Pour la démo MVP, associez un gadget personnel sans prendre celui
                d&apos;un autre utilisateur.
              </Text>
              <TouchableOpacity
                style={[styles.demoButton, assigning && styles.buttonDisabled]}
                onPress={() => {
                  void handleAssignDemoGadget();
                }}
                disabled={assigning}
              >
                {assigning ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.demoButtonText}>
                    ASSOCIER LE GADGET DE DÉMONSTRATION
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.gadgetLabel}>Ou saisir un identifiant</Text>
          <TextInput
            style={styles.input}
            value={gadgetInput}
            onChangeText={setGadgetInput}
            placeholder="Ex. GADGET_TEST"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            editable={!assigning}
          />
          <TouchableOpacity
            style={[styles.darkButton, assigning && styles.buttonDisabled]}
            onPress={() => {
              void handleAssignGadget();
            }}
            disabled={assigning}
          >
            {assigning ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.darkButtonText}>ASSOCIER UN GADGET</Text>
            )}
          </TouchableOpacity>
          {assignMessage ? (
            <Text style={styles.successText}>{assignMessage}</Text>
          ) : null}
          {assignError ? <Text style={styles.error}>{assignError}</Text> : null}
        </View>
      </ScrollView>
      <AppNavBar active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  authLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  userName: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  profileLink: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  logoutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  sosWrap: {
    alignItems: "center",
    marginVertical: 18,
  },
  sosHalo: {
    position: "absolute",
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: "rgba(220, 38, 38, 0.10)",
  },
  sosButton: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.card,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    elevation: 8,
  },
  sosButtonDisabled: {
    opacity: 0.85,
  },
  sosButtonText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: 1,
  },
  sosHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
  },
  modalIconWrap: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: "700",
    fontSize: 13,
  },
  modalSendButton: {
    flex: 1.2,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalSendText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  sosFeedbackSuccess: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 14,
  },
  sosFeedbackError: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 14,
  },
  sosFeedbackTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#047857",
    marginBottom: 6,
  },
  sosFeedbackTitleError: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark,
    marginBottom: 6,
  },
  sosFeedbackLine: {
    fontSize: 14,
    color: "#065F46",
    marginTop: 3,
  },
  sosFeedbackLineError: {
    fontSize: 14,
    color: "#991B1B",
    marginTop: 3,
  },
  sosFeedbackAction: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#047857",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  sosFeedbackActionText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  retryButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  gridCard: {
    width: "48%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 18,
    paddingHorizontal: 14,
    ...shadow.card,
    gap: 8,
  },
  gridCardDisabled: {
    opacity: 0.5,
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 14,
    ...shadow.card,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  sosBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sosBadgeText: {
    color: colors.primary,
    fontWeight: "800",
    fontSize: 11,
  },
  alertMeta: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  alertName: {
    marginTop: 4,
    fontSize: 15,
    color: colors.textSecondary,
  },
  alertGadget: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textMuted,
  },
  cardLink: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  gadgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },
  statusDotOff: {
    backgroundColor: "#D1D5DB",
  },
  gadgetName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  demoHint: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  demoButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: 12,
  },
  demoButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  gadgetLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  darkButton: {
    backgroundColor: colors.text,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: 10,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  successText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.success,
  },
  error: {
    marginTop: 8,
    fontSize: 14,
    color: colors.error,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  loader: {
    marginVertical: 8,
    alignSelf: "flex-start",
  },
});
