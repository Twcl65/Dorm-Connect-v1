import { Ionicons } from "@expo/vector-icons";
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
  Card,
  CenteredLoader,
  Input,
  Screen,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { SelectField } from "@/components/select-field";

const MAP_HEIGHT = Math.max(
  240,
  Math.min(Math.round(Dimensions.get("window").height * 0.34), 320)
);
const USTP_JASAAN = { latitude: 8.4542, longitude: 124.6319 };

function distanceFromUstp(latitude: number, longitude: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(latitude - USTP_JASAAN.latitude);
  const dLon = radians(longitude - USTP_JASAAN.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(USTP_JASAAN.latitude)) *
      Math.cos(radians(latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type DiscoveryMode = "top" | "nearest" | "all";

export default function BrowseScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [properties, setProperties] = useState<MapProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("top");
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
    }).sort((a, b) => {
      if (discoveryMode === "nearest") {
        return (
          distanceFromUstp(a.latitude, a.longitude) -
          distanceFromUstp(b.latitude, b.longitude)
        );
      }
      if (discoveryMode === "top") {
        const ratingDifference =
          (b.reviewSummary?.avg ?? -1) - (a.reviewSummary?.avg ?? -1);
        return ratingDifference || (b.reviewSummary?.count ?? 0) - (a.reviewSummary?.count ?? 0);
      }
      return a.name.localeCompare(b.name);
    });
  }, [properties, search, selectedPropertyId, discoveryMode]);

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
      propertyName: string;
      roomId: string;
      roomNo: string;
      price: number;
      address: string;
      capacity: number;
      availableSlots: number;
      rating: number | null;
      reviewCount: number;
      distanceKm: number;
    }[] = [];
    for (const p of filtered) {
      for (const r of p.rooms) {
        const capacity = Math.max(1, Number(r.capacity) || 1);
        const occupied = Math.max(0, Number(r.occupied) || 0);
        const availableSlots =
          r.availableSlots != null
            ? Math.max(0, r.availableSlots)
            : Math.max(0, capacity - occupied);
        rows.push({
          key: r.id,
          propertyName: p.name,
          roomId: r.id,
          roomNo: r.roomNo,
          price: r.price,
          address: p.address,
          capacity,
          availableSlots,
          rating: p.reviewSummary?.avg ?? null,
          reviewCount: p.reviewSummary?.count ?? 0,
          distanceKm: distanceFromUstp(p.latitude, p.longitude),
        });
      }
    }
    return rows;
  }, [filtered]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  if (loading && properties.length === 0) return <CenteredLoader />;

  return (
    <Screen style={styles.screen}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listRooms}
        keyExtractor={(item) => item.key}
        ListHeaderComponent={
          <View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={[styles.mapBox, { height: MAP_HEIGHT }]}>
              {mapMarkers.length > 0 ? (
                <MapErrorBoundary
                  fallback={
                    <View style={styles.mapEmpty}>
                      <Text style={styles.mapEmptyText}>
                        Map could not load. Browse rooms using the list below.
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
                    <Text style={styles.clear}>Unselect</Text>
                  </Pressable>
                </View>
              </Card>
            ) : null}

            <Text style={styles.sortLabel}>Sort rooms</Text>
            <View style={styles.filterRow}>
              <Pressable
                style={styles.searchToggle}
                onPress={() =>
                  setSearchVisible((visible) => {
                    if (visible) setSearch("");
                    return !visible;
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={searchVisible ? "Hide search" : "Show search"}
              >
                <Ionicons
                  name={searchVisible ? "close" : "search"}
                  size={21}
                  color={colors.navy}
                />
              </Pressable>
              <View style={styles.sortSelect}>
                <SelectField
                  label="Sort rooms"
                  placeholder="Choose how to sort"
                  hideLabel
                  compact
                  value={discoveryMode}
                  options={[
                    { value: "top", label: "Top reviewed" },
                    { value: "nearest", label: "Closest to USTP Jasaan" },
                    { value: "all", label: "Name A–Z" },
                  ]}
                  onChange={(value) => {
                    if (value === "top" || value === "nearest" || value === "all") {
                      setDiscoveryMode(value);
                    }
                  }}
                />
              </View>
            </View>
            {searchVisible ? (
              <Input
                autoFocus
                placeholder="Search property, location, or room"
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
            ) : null}
            <Text style={styles.sectionHint}>
              Distance estimates are from USTP Jasaan Campus.
            </Text>
            <Text style={styles.sectionLabel}>
              Available rooms ({listRooms.length})
            </Text>
          </View>
        }
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
        ListEmptyComponent={<Text style={styles.empty}>No rooms match your search.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowBody}
              onPress={() =>
                router.push({
                  pathname: "/listing/[id]",
                  params: { id: item.roomId },
                })
              }
            >
              <Text style={styles.rowTitle}>
                {item.propertyName} · Room {item.roomNo}
              </Text>
              <Text style={styles.rowMeta}>{item.address}</Text>
              <Text style={styles.rowMeta}>
                {item.rating != null
                  ? `★ ${item.rating.toFixed(1)} · ${item.reviewCount} review(s) · `
                  : ""}
                {item.distanceKm.toFixed(1)} km from USTP Jasaan
              </Text>
              <Text style={styles.rowMeta}>
                {item.availableSlots} available space(s) · {item.capacity} capacity
              </Text>
              <Text style={styles.rowPrice}>
                ₱{item.price.toLocaleString()} / month
              </Text>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  listContent: { paddingBottom: 24 },
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
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sortLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    alignSelf: "flex-start",
  },
  searchToggle: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  sortSelect: { flex: 1 },
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
    gap: 8,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  rowMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  rowPrice: { fontSize: 13, fontWeight: "600", color: colors.sky, marginTop: 4 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: colors.text, marginTop: 8 },
  sectionHint: { fontSize: 11, color: colors.muted, marginTop: 2, marginBottom: 8 },
});
