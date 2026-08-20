import { Ionicons } from "@expo/vector-icons";
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
import { ScreenHeader } from "../components/ScreenHeader";
import {
  addReference,
  deleteReference,
  getReferences,
  PublicUser,
  searchUserByEmail,
  UserReference,
} from "../services/api";
import { colors, radius, shadow } from "../theme";

function toUserFacingError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : "";
  const lower = raw.toLowerCase();

  if (lower.includes("introuvable") || lower === "not found") {
    return lower === "not found"
      ? "Fonctionnalité indisponible sur le serveur actuel."
      : "Nous n'avons trouvé aucun utilisateur avec cet email.";
  }

  if (lower.includes("déjà une référence") || lower.includes("déjà dans")) {
    return "Cette personne est déjà dans vos personnes de référence.";
  }

  if (lower.includes("vous-même") || lower.includes("vous ajouter")) {
    return "Vous ne pouvez pas vous ajouter vous-même.";
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("trop de temps") ||
    lower.includes("contacter le serveur")
  ) {
    return "Impossible de contacter le serveur. Vérifiez votre connexion.";
  }

  return raw || fallback;
}

export default function ContactsScreen() {
  const [references, setReferences] = useState<UserReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<PublicUser | null>(null);

  const [pendingDelete, setPendingDelete] = useState<UserReference | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const loadReferences = useCallback(async () => {
    setLoading(true);
    setListError(null);

    try {
      const data = await getReferences();
      setReferences(data);
    } catch (err) {
      setReferences([]);
      setListError(
        toUserFacingError(
          err,
          "Impossible de récupérer les personnes de référence."
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  const focusEmailField = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => {
      emailInputRef.current?.focus();
    }, 150);
  };

  const handleSearch = async () => {
    const trimmed = email.trim();

    if (!trimmed) {
      setFormError("Saisissez l'email de la personne.");
      setFormSuccess(null);
      setPreview(null);
      return;
    }

    if (searching || adding) {
      return;
    }

    setSearching(true);
    setFormError(null);
    setFormSuccess(null);
    setPreview(null);

    try {
      const found = await searchUserByEmail(trimmed);
      setPreview(found);
    } catch (err) {
      setPreview(null);
      setFormError(
        toUserFacingError(err, "Impossible de trouver cet utilisateur.")
      );
    } finally {
      setSearching(false);
    }
  };

  const cancelPreview = () => {
    setPreview(null);
  };

  const confirmAdd = async () => {
    if (!preview || adding) {
      return;
    }

    setAdding(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await addReference(preview.id);
      setFormSuccess("Personne ajoutée");
      setPreview(null);
      setEmail("");
      await loadReferences();
    } catch (err) {
      setFormError(
        toUserFacingError(err, "Impossible d'ajouter cette personne.")
      );
    } finally {
      setAdding(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) {
      return;
    }

    setDeleting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      await deleteReference(pendingDelete.id);
      setPendingDelete(null);
      await loadReferences();
    } catch (err) {
      setFormError(
        toUserFacingError(err, "Impossible de retirer cette personne.")
      );
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const busy = searching || adding || deleting;

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) {
            setPendingDelete(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Supprimer</Text>
            <Text style={styles.modalMessage}>
              Retirer {pendingDelete?.full_name} de vos personnes de référence ?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPendingDelete(null)}
                disabled={deleting}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>ANNULER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteButton,
                  deleting && styles.buttonDisabled,
                ]}
                onPress={() => {
                  void confirmDelete();
                }}
                disabled={deleting}
                activeOpacity={0.7}
              >
                {deleting ? (
                  <Text style={styles.modalDeleteText}>Suppression...</Text>
                ) : (
                  <Text style={styles.modalDeleteText}>SUPPRIMER</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.body}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            title="Mes contacts"
            subtitle="Personnes de référence"
          />

          <View style={styles.form}>
            <Text style={styles.formTitle}>
              Ajouter une personne de référence
            </Text>
            <Text style={styles.formHint}>
              Saisissez l'email d'un utilisateur Zua Alerte, puis recherchez-le
              pour l'ajouter.
            </Text>

            <TouchableOpacity
              style={styles.focusLink}
              onPress={focusEmailField}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Saisir l'email d'une personne"
            >
              <Text style={styles.focusLinkText}>Saisir un email</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Email de la personne</Text>
            <TextInput
              ref={emailInputRef}
              style={styles.input}
              placeholder="ex. personne@email.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!searching && !adding}
              onSubmitEditing={() => {
                void handleSearch();
              }}
              returnKeyType="search"
            />

            <TouchableOpacity
              style={[
                styles.searchButton,
                (searching || adding) && styles.buttonDisabled,
              ]}
              onPress={() => {
                void handleSearch();
              }}
              disabled={searching || adding}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Rechercher cette personne"
            >
              {searching ? (
                <View style={styles.buttonBusy}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.searchButtonText}>Recherche...</Text>
                </View>
              ) : (
                <Text style={styles.searchButtonText}>RECHERCHER</Text>
              )}
            </TouchableOpacity>

            {preview ? (
              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>Personne trouvée</Text>
                <Text style={styles.previewField}>
                  Nom : {preview.full_name}
                </Text>
                <Text style={styles.previewField}>Email : {preview.email}</Text>
                <Text style={styles.previewField}>
                  Téléphone : {preview.phone ? preview.phone : "—"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.previewConfirm,
                    adding && styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    void confirmAdd();
                  }}
                  disabled={adding}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Confirmer l'ajout de cette personne"
                >
                  {adding ? (
                    <View style={styles.buttonBusy}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                      <Text style={styles.previewConfirmText}>Ajout...</Text>
                    </View>
                  ) : (
                    <Text style={styles.previewConfirmText}>
                      CONFIRMER L'AJOUT
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewCancel}
                  onPress={cancelPreview}
                  disabled={adding}
                  activeOpacity={0.7}
                >
                  <Text style={styles.previewCancelText}>ANNULER</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            {formSuccess ? (
              <Text style={styles.success}>✓ {formSuccess}</Text>
            ) : null}
          </View>

          <Text style={styles.listTitle}>Mes personnes de référence</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : null}
          {listError ? <Text style={styles.error}>{listError}</Text> : null}

          {!loading && !listError && references.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                Vous n'avez pas encore de personne de référence.
              </Text>
              <Text style={styles.emptyHint}>
                Ajoutez une personne de confiance pour qu'elle puisse recevoir
                vos alertes SOS.
              </Text>
            </View>
          ) : null}

          {references.map((item) => (
            <View key={String(item.id)} style={styles.contactCard}>
              <View style={styles.contactRow}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={18} color={colors.primary} />
                </View>
                <View style={styles.contactInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.contactName}>{item.full_name}</Text>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={colors.success}
                    />
                  </View>
                  <Text style={styles.contactDetail}>{item.email}</Text>
                  {item.phone ? (
                    <Text style={styles.contactDetail}>{item.phone}</Text>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, busy && styles.buttonDisabled]}
                onPress={() => setPendingDelete(item)}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer ${item.full_name}`}
              >
                <Text style={styles.deleteText}>SUPPRIMER</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
      <AppNavBar active="contacts" />
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
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 22,
    ...shadow.card,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  formHint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  focusLink: {
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  focusLinkText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginBottom: 10,
    fontSize: 16,
    color: colors.text,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    borderRadius: radius.sm,
    alignItems: "center",
    marginTop: 5,
  },
  buttonBusy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  previewCard: {
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 14,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  previewField: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 6,
  },
  previewConfirm: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  previewConfirmText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  previewCancel: {
    marginTop: 10,
    backgroundColor: colors.border,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: "center",
  },
  previewCancelText: {
    color: colors.textSecondary,
    fontWeight: "700",
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  loader: {
    marginVertical: 12,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    ...shadow.card,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  error: {
    color: colors.error,
    marginTop: 12,
    fontSize: 14,
  },
  success: {
    color: colors.success,
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 16,
    marginBottom: 12,
    ...shadow.card,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  contactDetail: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 2,
  },
  deleteButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  deleteText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
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
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
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
    fontSize: 15,
  },
  modalDeleteButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
  },
  modalDeleteText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
