import { Alert } from "react-native";
import { uploadMobileFile } from "./upload";

export type LandlordPropertyOption = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type LandlordRoomDetail = {
  id: string;
  propertyId: string;
  roomNo: string;
  capacity: number;
  rate: number;
  status: string;
  remarks?: string;
  isListed?: boolean;
  listingLocation?: string;
  listingDescription?: string;
  listingImageUrls?: string[];
  listingBackgroundUrl?: string;
  roomImageUrls?: string[];
  roomSizeLabel?: string;
  roomDetails?: string;
};

export type LandlordRoomsDataResponse = {
  properties: LandlordPropertyOption[];
  selectedPropertyId: string;
  propertyName: string;
  stats: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    maintenance: number;
  };
  rooms: LandlordRoomDetail[];
};

export function formatPropertyAddress(
  p: LandlordPropertyOption | undefined
): string {
  if (!p) return "";
  return [p.address, p.city].filter(Boolean).join(", ").trim();
}

export function listingDescriptionFromRoom(room: LandlordRoomDetail): string {
  const parts: string[] = [];
  const details = room.roomDetails?.trim();
  const remarks = room.remarks?.trim();
  if (details) parts.push(details);
  if (remarks) parts.push(remarks);
  return parts.join("\n\n");
}

export async function pickImagesFromLibrary(
  maxCount = 12
): Promise<{ uri: string; fileName: string; mimeType: string }[]> {
  try {
    const ImagePicker = await import("expo-image-picker");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to attach images.");
      return [];
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsMultipleSelection: maxCount > 1,
      selectionLimit: maxCount,
    });
    if (result.canceled || !result.assets.length) return [];
    return result.assets.map((a, i) => ({
      uri: a.uri,
      fileName: a.fileName ?? `photo-${i + 1}.jpg`,
      mimeType: a.mimeType ?? "image/jpeg",
    }));
  } catch {
    Alert.alert(
      "Image picker unavailable",
      "Install expo-image-picker or add images on the website."
    );
    return [];
  }
}

export async function uploadMobileImages(
  token: string,
  assets: { uri: string; fileName: string; mimeType: string }[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const asset of assets) {
    const url = await uploadMobileFile(
      token,
      asset.uri,
      asset.fileName,
      asset.mimeType
    );
    urls.push(url);
  }
  return urls;
}
