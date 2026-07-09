import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest, formatSignInError } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordRoomsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<LandlordRoomDetail[]>([]);
  const [properties, setProperties] = useState<LandlordPropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [stats, setStats] = useState<LandlordRoomsDataResponse["stats"] | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const propertyIdRef = useRef("");

  const load = useCallback(
    async (pid?: string) => {
      if (!token) return;
      const activeId = pid ?? propertyIdRef.current;
      const qs = activeId
        ? `?propertyId=${encodeURIComponent(activeId)}`
        : "";
      const res = await apiRequest<LandlordRoomsDataResponse>(
        `/api/landlord/rooms-data${qs}`,
        { token }
      );
      setProperties(res.properties ?? []);
      const nextId = res.selectedPropertyId ?? activeId ?? "";
      propertyIdRef.current = nextId;
      setPropertyId(nextId);
      setPropertyName(res.propertyName ?? "");
      setStats(res.stats ?? null);
      setRooms(res.rooms ?? []);
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load(propertyId || undefined);
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setRefreshing(false);
    }
  };

  const selectProperty = async (pid: string) => {
    propertyIdRef.current = pid;
    setPropertyId(pid);
    setLoading(true);
    try {
      await load(pid);
      setError(null);
    } catch (e) {
      setError(formatSignInError(e));
    } finally {
      setLoading(false);
    }
  };

  if (loading && !refreshing) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>{propertyName || "Rooms"}</Subtitle>
      <Text style={styles.hint}>
        Add rooms and post listings for students — same flow as the website.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Add room"
          variant="brand"
          onPress={() =>
            router.push({
              pathname: "/landlord/add-room",
              params: propertyId ? { propertyId } : undefined,
            })
          }
        />
        <Button
          label="Post listing"
          variant="outline"
          onPress={() =>
            router.push({
              pathname: "/landlord/post-listing",
              params: propertyId ? { propertyId } : undefined,
            })
          }
        />
      </View>

      {properties.length > 1 ? (
        <View style={styles.propertyRow}>
          {properties.map((p) => (
            <Pressable key={p.id} onPress={() => void selectProperty(p.id)}>
              <View
                style={[
                  styles.propertyChip,
                  propertyId === p.id && styles.propertyChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.propertyChipText,
                    propertyId === p.id && styles.propertyChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {p.name}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {stats ? (
        <Text style={styles.stats}>
          {stats.total} rooms · {stats.available} available · {stats.occupied}{" "}
          occupied
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>
              No rooms yet. Tap Add room to create one under this property.
            </Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>Room {item.roomNo}</Text>
              <View style={styles.badges}>
                <Badge label={item.status} tone="default" />
                {item.isListed ? (
                  <Badge label="Posted" tone="success" />
                ) : (
                  <Badge label="Not posted" tone="warning" />
                )}
              </View>
            </View>
            <Text style={styles.meta}>
              ₱{item.rate.toLocaleString()} / month · Capacity {item.capacity}
            </Text>
            {item.roomSizeLabel ? (
              <Text style={styles.meta}>{item.roomSizeLabel}</Text>
            ) : null}
            {item.isListed && item.listingLocation ? (
              <Text style={styles.meta}>Location: {item.listingLocation}</Text>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  actions: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  propertyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  propertyChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    maxWidth: 160,
  },
  propertyChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandMuted,
  },
  propertyChipText: { fontSize: 12, color: colors.text },
  propertyChipTextActive: { color: colors.brand, fontWeight: "600" },
  stats: { fontSize: 12, color: colors.muted, marginBottom: 8 },
  error: { color: colors.red, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  badges: { alignItems: "flex-end", gap: 4 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted },
});
