import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { apiRequest, formatSignInError, type LandlordLease } from "@/lib/api";
import {
  Badge,
  Button,
  Card,
  CenteredLoader,
  Screen,
  Subtitle,
  Title,
  colors,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordTenantsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<LandlordLease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal State
  const [editingLease, setEditingLease] = useState<LandlordLease | null>(null);
  const [modalMode, setModalMode] = useState<"edit" | "moveout">("edit");
  const [showPicker, setShowPicker] = useState(false);
  const [dateType, setDateType] = useState<"start" | "end">("start");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await apiRequest<{ leases: LandlordLease[] }>("/api/landlord/leases", { token });
    setItems(res.leases ?? []);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  const handleEndLease = (lease: LandlordLease) => {
    setEditingLease(lease);
    setEditStart(lease.leaseStart ?? "");
    setEditEnd(new Date().toISOString().split("T")[0]);
    setModalMode("moveout");
  };

  const handleUpdateDates = async () => {
    if (!token || !editingLease) return;
    setUpdating(true);
    try {
      await apiRequest(`/api/landlord/leases/${editingLease.id}`, {
        method: "PATCH",
        token,
        body: {
          leaseStart: editStart,
          leaseEnd: editEnd,
        },
      });
      setEditingLease(null);
      await load();
    } catch (e) {
      Alert.alert("Failed", e instanceof Error ? e.message : "Request failed.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading && items.length === 0) return <CenteredLoader />;

  return (
    <Screen>
      <View style={{ marginBottom: 16 }}>
        <Title style={{ color: colors.brand }}>Tenants Management</Title>
        <Subtitle>Active tenants and lease agreements</Subtitle>
      </View>
      
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ paddingBottom: 40 }}
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
          <Card>
            <Text style={styles.empty}>No active tenants found.</Text>
          </Card>
        }
        renderItem={({ item }) => {
          const isMovedOut = item.leaseEnd && item.leaseEnd <= new Date().toISOString().split("T")[0];
          let formattedEnd = item.leaseEnd;
          if (item.leaseEnd) {
            const d = new Date(item.leaseEnd);
            formattedEnd = `${d.toLocaleString("default", { month: "long" })} ${d.getDate()}, ${d.getFullYear()}`;
          }

          return (
            <Card>
              <View style={styles.top}>
                <Text style={styles.title}>{item.name}</Text>
                <Badge label={`Room ${item.roomNo}`} tone="default" />
              </View>
              <Text style={styles.meta}>Lease: {item.leasePeriod}</Text>
              {item.advancePayments ? <Text style={styles.meta}>Advance Payments: ₱{item.advancePayments.toLocaleString()}</Text> : null}
              {item.deposits ? <Text style={styles.meta}>Deposits: ₱{item.deposits.toLocaleString()}</Text> : null}
              {item.remainingBalance !== undefined ? <Text style={styles.meta}>Balance Remaining: ₱{item.remainingBalance.toLocaleString()}</Text> : null}
              
              {isMovedOut ? (
                <View style={styles.actions}>
                  <Text style={{ flex: 1, textAlign: 'center', color: colors.muted, fontStyle: 'italic', paddingVertical: 12, fontWeight: '500' }}>
                    Moved out on {formattedEnd}
                  </Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Edit Lease"
                      variant="outline"
                      onPress={() => {
                        setModalMode("edit");
                        setEditingLease(item);
                        setEditStart(item.leaseStart ?? "");
                        setEditEnd(item.leaseEnd ?? "");
                      }}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Move out"
                      variant="danger"
                      onPress={() => handleEndLease(item)}
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />

      <Modal visible={!!editingLease} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>
            {modalMode === "edit" ? "Edit Lease Dates" : "Move Out Tenant"}
          </Text>
          <Text style={styles.modalSub}>
            {modalMode === "edit"
              ? `Adjust the lease period for ${editingLease?.name} (Room ${editingLease?.roomNo}).`
              : `Set the move-out date for ${editingLease?.name} (Room ${editingLease?.roomNo}).`}
          </Text>

          {modalMode === "edit" ? (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Lease Start</Text>
              <Button
                label={editStart || "Select Start Date"}
                variant="outline"
                onPress={() => {
                  setDateType("start");
                  setShowPicker(true);
                }}
              />
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>
              {modalMode === "edit" ? "Lease End" : "Move Out Date"}
            </Text>
            <Button
              label={editEnd || "Select End Date"}
              variant="outline"
              onPress={() => {
                setDateType("end");
                setShowPicker(true);
              }}
            />
          </View>

          {showPicker ? (
            <DateTimePicker
              value={
                dateType === "start"
                  ? (editStart ? new Date(editStart) : new Date())
                  : (editEnd ? new Date(editEnd) : new Date())
              }
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                setShowPicker(Platform.OS === "ios");
                if (date) {
                  const formatted = date.toISOString().split("T")[0];
                  if (dateType === "start") setEditStart(formatted);
                  else setEditEnd(formatted);
                }
              }}
            />
          ) : null}

          {Platform.OS === "ios" && showPicker ? (
            <Button
              label="Done"
              variant="brand"
              onPress={() => setShowPicker(false)}
            />
          ) : null}

          <View style={styles.actionsRow}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => {
                  setEditingLease(null);
                  setShowPicker(false);
                }}
                disabled={updating}
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Button
                label={modalMode === "edit" ? "Save Changes" : "Confirm Move Out"}
                variant={modalMode === "edit" ? "brand" : "danger"}
                onPress={handleUpdateDates}
                loading={updating}
                disabled={updating || !editEnd.trim() || (modalMode === "edit" && !editStart.trim())}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.red, fontSize: 13, marginBottom: 8 },
  empty: { fontSize: 13, color: colors.muted },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  title: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginBottom: 4 },
  
  actions: {
    flexDirection: "row",
    marginTop: 16,
  },

  modalContent: {
    flex: 1,
    padding: 24,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.brand,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.white,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 24,
  },
});
