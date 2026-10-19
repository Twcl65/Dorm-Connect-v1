import { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { resolveMediaUrl } from "@/lib/config";
import { colors } from "@/components/ui";

export function ImageGallery({
  urls,
  alt,
}: {
  urls: string[];
  alt: string;
}) {
  const resolved = useMemo(
    () =>
      urls
        .map((u) => resolveMediaUrl(u))
        .filter((u): u is string => Boolean(u)),
    [urls]
  );
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const active = resolved[index] ?? null;

  if (resolved.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="image-outline" size={32} color={colors.muted} />
        <Text style={styles.placeholderText}>No photo</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.heroWrap}>
        <Pressable onPress={() => setLightbox(active)}>
          <Image source={{ uri: active! }} style={styles.hero} resizeMode="cover" />
        </Pressable>
        <Text style={styles.tapHint}>Tap to enlarge</Text>
      </View>
      {resolved.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.thumbs}
          contentContainerStyle={styles.thumbsContent}
        >
          {resolved.map((uri, i) => (
            <Pressable
              key={uri}
              onPress={() => {
                setIndex(i);
                setLightbox(uri);
              }}
              style={[styles.thumbWrap, i === index && styles.thumbActive]}
            >
              <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={lightbox != null} transparent animationType="fade">
        <Pressable style={styles.lightbox} onPress={() => setLightbox(null)}>
          <Pressable style={styles.closeBtn} onPress={() => setLightbox(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {lightbox ? (
            <Image
              source={{ uri: lightbox }}
              style={styles.lightboxImg}
              resizeMode="contain"
              accessibilityLabel={alt}
            />
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heroWrap: { position: "relative", marginBottom: 4 },
  hero: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
  },
  tapHint: {
    position: "absolute",
    bottom: 8,
    right: 10,
    fontSize: 11,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  thumbs: { marginTop: 8 },
  thumbsContent: { gap: 8 },
  thumbWrap: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  thumbActive: { borderColor: colors.sky },
  thumb: { width: 72, height: 56 },
  placeholder: {
    height: 220,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: { marginTop: 8, fontSize: 13, color: colors.muted },
  lightbox: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  lightboxImg: { width: "100%", height: "80%" },
  closeBtn: { position: "absolute", top: 48, right: 20, zIndex: 2 },
});
