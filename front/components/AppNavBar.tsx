import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, radius } from "../theme";

type AppNavBarProps = {
  active: "home" | "contacts" | "history";
};

export function AppNavBar({ active }: AppNavBarProps) {
  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.item} onPress={() => router.push("/")}>
        <Ionicons
          name={active === "home" ? "home" : "home-outline"}
          size={22}
          color={active === "home" ? colors.primary : colors.textMuted}
        />
        <Text style={[styles.label, active === "home" && styles.labelActive]}>
          Accueil
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push("/contacts")}
      >
        <Ionicons
          name={active === "contacts" ? "people" : "people-outline"}
          size={22}
          color={active === "contacts" ? colors.primary : colors.textMuted}
        />
        <Text
          style={[styles.label, active === "contacts" && styles.labelActive]}
        >
          Contacts
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.item}
        onPress={() => router.push("/history")}
      >
        <Ionicons
          name={active === "history" ? "time" : "time-outline"}
          size={22}
          color={active === "history" ? colors.primary : colors.textMuted}
        />
        <Text
          style={[styles.label, active === "history" && styles.labelActive]}
        >
          Alertes
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.primary,
  },
});
