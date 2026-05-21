import { MenuLink } from "@/components/menu-link";
import { Screen, Subtitle, Title, colors } from "@/components/ui";

export default function LandlordMoreTab() {
  return (
    <Screen>
      <Title style={{ color: colors.brand }}>More</Title>
      <Subtitle>Properties, reports, and account</Subtitle>

      <MenuLink
        href="/landlord/properties"
        label="Properties"
        subtitle="Your dorm properties"
        icon="business-outline"
      />
      <MenuLink
        href="/landlord/rooms"
        label="Rooms"
        subtitle="Room list and status"
        icon="bed-outline"
      />
      <MenuLink
        href="/landlord/reports"
        label="Manage dorm reports"
        subtitle="Download tenant, payment, and room reports"
        icon="document-text-outline"
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
        subtitle="Profile and sign out"
        icon="person-outline"
      />
    </Screen>
  );
}
