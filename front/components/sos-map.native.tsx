import MapView, { Marker } from "react-native-maps";
import { StyleSheet } from "react-native";

type SosMapProps = {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
};

export function SosMap({
  latitude,
  longitude,
  title,
  description,
}: SosMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker
        coordinate={{
          latitude,
          longitude,
        }}
        title={title}
        description={description}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: "100%",
    height: "100%",
  },
});
