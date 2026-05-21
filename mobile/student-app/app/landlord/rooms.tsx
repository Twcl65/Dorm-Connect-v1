import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError } from "@/lib/api";
import { Badge, Card, CenteredLoader, Screen, Subtitle, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

type RoomRow = {
  id: string;
  roomNo: string;
  status: string;
  rate?: number;
  capacity?: number;
};

export default function LandlordRoomsScreen() {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [propertyName, setPropertyName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await apiRequest<{
            propertyName?: string;
            rooms: RoomRow[];
          }>("/api/landlord/rooms-data", { token: token! });
          setRooms(res.rooms ?? []);
          setPropertyName(res.propertyName ?? "");
          setError(null);
        } catch (e) {
          setError(formatSignInError(e));
        } finally {
          setLoading(false);
        }
      })();
    }, [token])
  );

  if (loading) return <CenteredLoader />;

  return (
    <Screen>
      <Subtitle>{propertyName || "Rooms"}</Subtitle>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rooms}
        keyExtractor={(r) => r.id}
        ListEmptyComponent={
          <Card>
            <Text style={styles.empty}>No rooms found.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>Room {item.roomNo}</Text>
              <Badge label={item.status} tone="default" />
            </View>
            {item.rate != null ? (
              <Text style={styles.meta}>
                ₱{item.rate.toLocaleString()} / month
              </Text>
            ) : null}
            {item.capacity != null ? (
              <Text style={styles.meta}>Capacity: {item.capacity}</Text>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, marginBottom: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  empty: { fontSize: 13, color: colors.muted },
});
