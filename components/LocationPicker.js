import React, { useState, useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, TextInput, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import mapboxClient from "../utils/mapbox";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";

export default function LocationPicker({ onLocationPicked, initialLocation }) {
  const [region, setRegion] = useState(null);
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
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

  const goToMyLocation = async () => {
    try {
      setLocating(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        alert("Location permission denied");
        setLocating(false);
        return;
      }

      const userLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });

      const { latitude, longitude } = userLoc.coords;

      setRegion(prev => ({
        ...prev,
        latitude,
        longitude
      }));

      reverseGeocode(latitude, longitude);

      mapRef.current?.animateCamera(
        { center: { latitude, longitude } },
        { duration: 300 }
      );
    } catch (err) {
      console.log("Location fetch error:", err);
    } finally {
      setLocating(false);
    }
  };



  const fetchSuggestions = async (text) => {
    setQuery(text);

    if (!text.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await mapboxClient
        .forwardGeocode({
          query: text,
          limit: 5,
          countries: ["ph"]
        })
        .send();

      const matches = response.body.features.map(f => ({
        name: f.place_name,
        coords: f.center, // [lon, lat]
      }));

      setSuggestions(matches);
    } catch (e) {
      console.log("Mapbox Error:", e);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });

      if (results?.length > 0) {
        const r = results[0];
        const fullAddress =
          `${r.name ?? ""} ${r.street ?? ""}, ${r.city ?? ""}, ${r.region ?? ""}, ${r.country ?? ""}`.trim();

        setAddress(fullAddress);
        onLocationPicked({ latitude: lat, longitude: lng, geocoded_address: fullAddress });
      } else {
        setAddress("Unknown location");
        onLocationPicked({ latitude: lat, longitude: lng, geocoded_address: "Unknown location" });
      }
    } catch (e) {
      console.log("Reverse geocode failed:", e);
    }
  };

  if (loading) return <ActivityIndicator size="large" />;

  return (
    <View style={{ height: 300, marginVertical: 10 }}>
      {/* Search Bar */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
        <TextInput
          placeholder="Search address..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: "#ccc",
            padding: 10,
            borderRadius: 6,
            backgroundColor: "#fff",
            marginRight: 8
          }}
          value={query}
          onChangeText={fetchSuggestions}
          returnKeyType="search"
        />

        <TouchableOpacity
          onPress={locating ? null : goToMyLocation}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#ccc",
            elevation: 3,
            opacity: locating ? 0.6 : 1
          }}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="locate" size={20} color="#000" />
          )}
        </TouchableOpacity>

      </View>

      {/* Suggestions Dropdown */}
      {suggestions.length > 0 && (
        <View style={{
          position: "absolute",
          top: 45,
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: "white",
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 6,
          maxHeight: 200
        }}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
            style={{ maxHeight: 200 }}
          >
            {suggestions.map((item, index) => (
              <Text
                key={index}
                style={{
                  padding: 10,
                  borderBottomWidth: index === suggestions.length - 1 ? 0 : 1,
                  borderColor: "#eee"
                }}
                onPress={() => {
                  const [lon, lat] = item.coords;

                  const newRegion = {
                    latitude: lat,
                    longitude: lon,
                    latitudeDelta: region.latitudeDelta,
                    longitudeDelta: region.longitudeDelta
                  };

                  setQuery(item.name);
                  setSuggestions([]);
                  setRegion(newRegion);
                  reverseGeocode(lat, lon);

                  mapRef.current?.animateCamera({
                    center: {
                      latitude: newRegion.latitude,
                      longitude: newRegion.longitude
                    }
                  }, { duration: 300 });
                }}
              >
                {item.name}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Map */}
      {region && (
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={region}  // ✅ only set once
          onPress={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;

            reverseGeocode(latitude, longitude);

            setRegion(prev => ({
              ...prev,
              latitude,
              longitude
            }));

            mapRef.current?.animateCamera({
              center: { latitude, longitude }
            }, { duration: 300 });
          }}
        >
          <Marker coordinate={region} />
        </MapView>



      )}


      <Text style={{ marginTop: 8, fontWeight: "bold" }}>
        {address ? `📍 ${address}` : "Tap map to set location"}
      </Text>
    </View>
  );
}
