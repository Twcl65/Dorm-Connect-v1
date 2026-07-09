import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { PaymentReceiptCard } from "@/components/payment-receipt-card";
import {
  apiRequest,
  formatSignInError,
  type PaymentReceiptData,
} from "@/lib/api";
import { CenteredLoader, Screen, Subtitle, Title, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function PaymentReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [payment, setPayment] = useState<PaymentReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setError(null);
    const res = await apiRequest<{ payment: PaymentReceiptData }>(
      `/api/student/payments/${encodeURIComponent(id)}`,
      { token }
    );
    setPayment(res.payment ?? null);
  }, [token, id]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          setError(formatSignInError(e));
          setPayment(null);
        } finally {
          setLoading(false);
        }
      })();
    }, [load])
  );

  if (loading && !payment) {
    return <CenteredLoader />;
  }

  return (
    <Screen style={styles.screen}>
      <Title>Receipt</Title>
      <Subtitle>Official payment record from DormConnect</Subtitle>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {payment ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <PaymentReceiptCard payment={payment} />
        </ScrollView>
      ) : !error ? (
        <Text style={styles.error}>Payment not found.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  scroll: { paddingBottom: 32 },
  error: { color: colors.red, fontSize: 13, marginBottom: 12 },
});
