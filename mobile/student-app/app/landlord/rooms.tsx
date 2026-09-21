import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest, formatSignInError } from "@/lib/api";
import type {
  LandlordPropertyOption,
  LandlordRoomDetail,
  LandlordRoomsDataResponse,
} from "@/lib/landlord-rooms";
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

  const deleteRoom = (id: string, roomNo: string) => {
    Alert.alert(
      "Delete Room",
      `Are you sure you want to delete Room ${roomNo}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!token) return;
            setLoading(true);
            try {
              await apiRequest(`/api/landlord/rooms/${id}`, {
                method: "DELETE",
                token,
              });
              await load(propertyId || undefined);
            } catch (e) {
              Alert.alert("Failed", e instanceof Error ? e.message : "Request failed.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
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
          fullWidth
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
          fullWidth
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
            {item.occupants ? (
              <Text style={styles.occupants}>Occupied by: {item.occupants}</Text>
            ) : null}
            <View style={styles.cardActions}>
              <Button
                label="Delete"
                variant="danger"
                onPress={() => deleteRoom(item.id, item.roomNo)}
              />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  actions: { gap: 10, marginBottom: 12 },
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
  occupants: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.brand,
    marginTop: 4,
  },
  cardActions: { marginTop: 12 },
});
