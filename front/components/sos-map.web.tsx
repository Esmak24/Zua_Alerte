import { createElement } from "react";
import { StyleSheet, View } from "react-native";

type SosMapProps = {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
};

/**
 * Carte Web pour Expo Web / démo MVP.
 * Google Maps embed (fiable en navigateur) — Android/iOS restent sur react-native-maps.
 */
export function SosMap({ latitude, longitude, title }: SosMapProps) {
  const q = `${latitude},${longitude}`;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;

  return (
    <View style={styles.map}>
      {createElement("iframe", {
        src,
        style: {
          border: 0,
          width: "100%",
          height: "100%",
          minHeight: 280,
        },
        title: title || "Localisation SOS",
        allowFullScreen: true,
        loading: "lazy",
        referrerPolicy: "no-referrer-when-downgrade",
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
    minHeight: 280,
    backgroundColor: "#E5E7EB",
  },
});
