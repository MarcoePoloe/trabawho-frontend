import React, { useState, useEffect } from "react";
import { View, Text, Button, ActivityIndicator } from "react-native";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

export default function LocationPicker({ onLocationPicked, initialLocation }) {
  const [region, setRegion] = useState(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Use initial location if editing
      if (initialLocation) {
        setRegion({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        reverseGeocode(initialLocation.latitude, initialLocation.longitude);
        setLoading(false);
        return;
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoading(false);
        return;
      }

      const userLoc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: userLoc.coords.latitude,
        longitude: userLoc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      reverseGeocode(userLoc.coords.latitude, userLoc.coords.longitude);
      setLoading(false);
    })();
  }, []);

  const reverseGeocode = async (lat, lng) => {
    let results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results?.length > 0) {
      const r = results[0];
      const fullAddress = `${r.name ?? ""} ${r.street ?? ""}, ${r.city ?? ""}, ${r.region ?? ""}, ${r.country ?? ""}`;
      setAddress(fullAddress);
      onLocationPicked({ latitude: lat, longitude: lng, geocoded_address: fullAddress });
    }
  };

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <View style={{ height: 300, marginVertical: 10 }}>
      {region && (
        <MapView
          style={{ flex: 1 }}
          initialRegion={region}
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            setRegion(prev => ({ ...prev, latitude, longitude }));
            reverseGeocode(latitude, longitude);
          }}
        >
          <Marker coordinate={region} draggable />
        </MapView>
      )}

      <Text style={{ marginTop: 8, fontWeight: "bold" }}>
        {address ? `📍 ${address}` : "Tap map to set location"}
      </Text>
    </View>
  );
}
