import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { StudentDormMap } from "@/components/student-dorm-map";
import { MapErrorBoundary } from "@/components/map-error-boundary";
import {
  apiRequest,
  formatSignInError,
  type MapProperty,
} from "@/lib/api";
import { isValidMapCoordinate } from "@/lib/map-coords";
import {
  Badge,
  Card,
  CenteredLoader,
  Input,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

const MAP_HEIGHT = Math.round(Dimensions.get("window").height * 0.42);

export default function BrowseScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    const res = await apiRequest<{ properties: MapProperty[] }>(
      "/api/student/map-properties",
      { token }
    );
    setProperties(res.properties ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setProperties([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (selectedPropertyId && p.id !== selectedPropertyId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.landlordName.toLowerCase().includes(q) ||
        p.rooms.some((r) => r.roomNo.toLowerCase().includes(q))
      );
    });
  }, [properties, search, selectedPropertyId]);

  const mapMarkers = useMemo(
    () =>
      properties
        .filter((p) => isValidMapCoordinate(p.latitude, p.longitude))
        .map((p) => ({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          coverImageUrl: p.coverImageUrl,
        })),
    [properties]
  );

  const listRooms = useMemo(() => {
    const rows: {
      key: string;
      propertyId: string;
      propertyName: string;
      roomId: string;
      roomNo: string;
      price: number;
      address: string;
    }[] = [];
    for (const p of filtered) {
      for (const r of p.rooms) {
        rows.push({
          key: r.id,
          propertyId: p.id,
          propertyName: p.name,
          roomId: r.id,
          roomNo: r.roomNo,
          price: r.price,
          address: p.address,
        });
      }
    }
    return rows;
  }, [filtered]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (loading && properties.length === 0) return <CenteredLoader />;

  return (
    <Screen style={styles.screen}>
      <Subtitle>Tap a circle on the map or pick a room below</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={[styles.mapBox, { height: MAP_HEIGHT }]}>
        {mapMarkers.length > 0 ? (
          <MapErrorBoundary
            fallback={
              <View style={styles.mapEmpty}>
                <Text style={styles.mapEmptyText}>
                  Map could not load. Scroll down to browse rooms by list.
                </Text>
              </View>
            }
          >
            <StudentDormMap
              markers={mapMarkers}
              selectedId={selectedPropertyId}
              onMarkerPress={(id) => {
                setSelectedPropertyId((prev) => (prev === id ? null : id));
              }}
            />
          </MapErrorBoundary>
        ) : (
          <View style={styles.mapEmpty}>
            <Text style={styles.mapEmptyText}>
              No dorm locations on the map yet.
            </Text>
          </View>
        )}
      </View>

      {selectedProperty ? (
        <Card>
          <View style={styles.selectedHeader}>
            <View style={styles.selectedBody}>
              <Text style={styles.selectedTitle}>{selectedProperty.name}</Text>
              <Text style={styles.selectedMeta}>{selectedProperty.address}</Text>
              <Text style={styles.selectedMeta}>
                {selectedProperty.rooms.length} available room(s)
              </Text>
            </View>
            <Pressable onPress={() => setSelectedPropertyId(null)}>
              <Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Input
        placeholder="Search dorm, location, or room…"
        value={search}
        onChangeText={setSearch}
      />

      <FlatList
        style={styles.list}
        data={listRooms}
        keyExtractor={(item) => item.key}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } catch (e) {
                setError(formatSignInError(e));
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No rooms match your search.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: "/listing/[id]",
                params: { id: item.roomId },
              })
            }
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>
                {item.propertyName} · Room {item.roomNo}
              </Text>
              <Text style={styles.rowMeta}>{item.address}</Text>
              <Text style={styles.rowPrice}>
                ₱{item.price.toLocaleString()} / month
              </Text>
            </View>
            <Badge label="View" tone="success" />
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
  mapBox: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 10,
  },
  mapEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  mapEmptyText: { fontSize: 13, color: "#64748b", padding: 16, textAlign: "center" },
  selectedHeader: { flexDirection: "row", alignItems: "flex-start" },
  selectedBody: { flex: 1 },
  selectedTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  selectedMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  clear: { fontSize: 13, fontWeight: "600", color: colors.sky },
  list: { flex: 1 },
  empty: { textAlign: "center", color: "#94a3b8", marginTop: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 10,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  rowPrice: { fontSize: 13, fontWeight: "600", color: colors.sky, marginTop: 4 },
});
