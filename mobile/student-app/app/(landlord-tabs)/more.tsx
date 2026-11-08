import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { Button } from "@/components/ui";
import { MenuLink } from "@/components/menu-link";
import { Screen, Subtitle, Title, colors } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function LandlordMoreTab() {
  const { signOut } = useAuth();
  const router = useRouter();

  return (
    <Screen>
      <Title style={{ color: colors.brand }}>More</Title>
      <Subtitle>Properties, reports, and account</Subtitle>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <MenuLink
          href="/landlord/properties"
          label="Properties"
          subtitle="Add and manage dorm properties"
          icon="business-outline"
        />
        <MenuLink
          href="/landlord/rooms"
          label="Rooms"
          subtitle="Add rooms and post listings for students"
          icon="bed-outline"
        />
        <MenuLink
          href="/landlord/reviews"
          label="View reviews"
          subtitle="Read student feedback and see your average rating"
          icon="star-outline"
        />
        <MenuLink
          href="/landlord/terms-settings"
          label="Terms & conditions"
          subtitle="Manage property-specific house rules"
          icon="document-text-outline"
        />
        <MenuLink
          href="/landlord/tenants"
          label="Tenants"
          subtitle="Manage active leases and move-outs"
          icon="people-outline"
        />
        <MenuLink
          href="/landlord/income-reports"
          label="Financial reports"
          subtitle="Monthly rent, advance payments, and held security deposits"
          icon="cash-outline"
        />
        <MenuLink
          href="/landlord/reports"
          label="Manage dorm reports"
          subtitle="Download tenant, payment, and room reports"
          icon="document-text-outline"
        />
        <MenuLink
          href="/landlord/tenant-reports"
          label="Tenant Reports (OSA)"
          subtitle="Report tenants to the OSA and view status"
          icon="alert-circle-outline"
        />
        <MenuLink
          href="/landlord/activity-logs"
          label="Activity logs"
          subtitle="Recent actions on your account"
          icon="time-outline"
        />
        <MenuLink
          href="/landlord/documents"
          label="Accreditation documents"
          subtitle="Accreditation requests and status"
          icon="folder-outline"
        />
        <MenuLink
          href="/settings"
          label="Account settings"
          subtitle="Update your profile and account details"
          icon="settings-outline"
        />
        <Button
          label="Sign out"
          variant="danger"
          onPress={async () => {
            await signOut();
            router.replace("/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}
