import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

type Props = {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
};

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .leaflet-container { font-family: system-ui, sans-serif; }
    .property-pin-icon { background: transparent; border: 0; }
    .property-pin {
      width: 26px; height: 26px; border: 3px solid #fff; border-radius: 50% 50% 50% 0;
      background: #16a34a; box-shadow: 0 2px 8px rgba(0,0,0,.35);
      transform: rotate(-45deg);
    }
    .property-pin::after {
      content: ""; display: block; width: 8px; height: 8px; margin: 6px;
      border-radius: 50%; background: #fff;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true }).setView([8.4542, 124.6319], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    const pinIcon = L.divIcon({
      className: 'property-pin-icon',
      html: '<div class="property-pin"></div>',
      iconSize: [32, 42],
      iconAnchor: [16, 42],
    });
    let pin = null;
    window.setPropertyPin = function(latitude, longitude, center) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        if (pin) map.removeLayer(pin);
        pin = null;
        return;
      }
      if (!pin) pin = L.marker([latitude, longitude], { icon: pinIcon }).addTo(map);
      else pin.setLatLng([latitude, longitude]);
      if (center) map.setView([latitude, longitude], 17);
    };
    map.on('click', function(event) {
      window.setPropertyPin(event.latlng.lat, event.latlng.lng, false);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'location',
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
        }));
      }
    });
  </script>
</body>
</html>`;

export function LandlordPropertyLocationPicker({
  latitude,
  longitude,
  onChange,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const hasCenteredOnPin = useRef(false);

  useEffect(() => {
    if (!loaded) return;

    const hasLocation = latitude != null && longitude != null;
    const center = hasLocation && !hasCenteredOnPin.current;
    if (hasLocation) hasCenteredOnPin.current = true;
    else hasCenteredOnPin.current = false;

    webViewRef.current?.injectJavaScript(
      `window.setPropertyPin(${JSON.stringify(latitude)}, ${JSON.stringify(longitude)}, ${center}); true;`
    );
  }, [latitude, longitude, loaded]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        latitude?: number;
        longitude?: number;
      };
      if (
        data.type === "location" &&
        typeof data.latitude === "number" &&
        typeof data.longitude === "number" &&
        Number.isFinite(data.latitude) &&
        Number.isFinite(data.longitude) &&
        data.latitude >= -90 &&
        data.latitude <= 90 &&
        data.longitude >= -180 &&
        data.longitude <= 180
      ) {
        onChange(data.latitude, data.longitude);
      }
    } catch {
      return;
    }
  };

  return (
    <View style={styles.frame}>
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: MAP_HTML }}
        originWhitelist={["*"]}
        onLoadEnd={() => setLoaded(true)}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        bounces={false}
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 240,
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9",
  },
  map: { flex: 1, backgroundColor: "#f1f5f9" },
});
