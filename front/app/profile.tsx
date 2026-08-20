import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ScreenHeader } from "../components/ScreenHeader";
import {
  AppNotification,
  AuthUser,
  getCurrentUser,
  getNotifications,
  toUserFacingApiError,
  updateProfile,
} from "../services/api";
import { colors, radius, shadow } from "../theme";

export default function ProfileScreen() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifNote, setNotifNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const me = await getCurrentUser();
      setUser(me);
      setFullName(me.full_name);
      setPhone(me.phone ?? "");

      try {
        const notifs = await getNotifications();
        setNotifications(notifs);
        setNotifNote(
          notifs.length === 0
            ? "Aucune notification enregistrée pour votre compte."
            : "Notifications enregistrées côté serveur (push Expo non envoyé en MVP)."
        );
      } catch {
        setNotifications([]);
        setNotifNote(
          "Notifications indisponibles pour le moment (push réel hors MVP)."
        );
      }
    } catch (err) {
      setError(toUserFacingApiError(err, "Impossible de charger le profil."));
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    const name = fullName.trim();

    if (!name) {
      setError("Le nom complet est obligatoire.");
      setSuccess(null);
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await updateProfile({
        full_name: name,
        phone: phone.trim(),
      });
      setUser(updated);
      setFullName(updated.full_name);
      setPhone(updated.phone ?? "");
      setSuccess("Profil mis à jour.");
    } catch (err) {
      setError(toUserFacingApiError(err, "Impossible de mettre à jour le profil."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.error}>{error ?? "Profil indisponible."}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace("/")}>
            <Text style={styles.secondaryBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Mon profil"
          subtitle="Consultez et modifiez vos informations."
        />

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.hint}>L'email ne peut pas être modifié ici.</Text>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Votre nom"
            placeholderTextColor={colors.textMuted}
            editable={!saving}
          />

          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Optionnel"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            editable={!saving}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={() => {
              void handleSave();
            }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>ENREGISTRER</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.notifHeader}>
            <Ionicons name="notifications-outline" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          {notifNote ? <Text style={styles.hint}>{notifNote}</Text> : null}
          {notifications.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.notifItem}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <Text style={styles.notifBody}>{item.body}</Text>
              <Text style={styles.notifMeta}>
                Statut : {item.status} (enregistrée)
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Retour à l'accueil</Text>
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
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    ...shadow.card,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  email: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 4,
    lineHeight: 18,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 18,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  disabled: {
    opacity: 0.75,
  },
  error: {
    color: colors.error,
    marginTop: 10,
    fontSize: 14,
  },
  success: {
    color: colors.success,
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  notifHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },
  notifItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notifTitle: {
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  notifBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  notifMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  secondaryBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryBtnText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
});
