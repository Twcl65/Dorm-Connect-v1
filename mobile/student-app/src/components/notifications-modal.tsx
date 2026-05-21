import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NotificationItem } from "@/lib/api";
import { Badge, Button, Card, colors } from "@/components/ui";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  items: NotificationItem[];
  loading: boolean;
  unread: number;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

export function NotificationsModal({
  visible,
  onClose,
  items,
  loading,
  unread,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Notifications</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.navy} />
            </Pressable>
          </View>

          {unread > 0 && (
            <Button
              label="Mark all read"
              variant="outline"
              onPress={onMarkAllRead}
            />
          )}

          {loading && items.length === 0 ? (
            <ActivityIndicator color={colors.sky} style={{ marginVertical: 24 }} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(x) => x.id}
              style={styles.list}
              ListEmptyComponent={
                <Text style={styles.empty}>No notifications yet.</Text>
              }
              refreshing={loading}
              onRefresh={onRefresh}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (!item.read) onMarkRead(item.id);
                  }}
                >
                  <Card
                    style={
                      !item.read
                        ? { borderColor: colors.sky, borderWidth: 1 }
                        : undefined
                    }
                  >
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category} · {formatWhen(item.createdAt)}
                    </Text>
                    <Text style={styles.itemBody}>{item.body}</Text>
                    {!item.read && <Badge label="Unread" tone="warning" />}
                  </Card>
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "78%",
    padding: 16,
    paddingBottom: 28,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.navy,
  },
  list: { marginTop: 8 },
  empty: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 13,
    marginVertical: 24,
  },
  itemTitle: { fontSize: 15, fontWeight: "600", color: colors.navy },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  itemBody: { fontSize: 14, color: "#334155", marginTop: 6, lineHeight: 20 },
});
