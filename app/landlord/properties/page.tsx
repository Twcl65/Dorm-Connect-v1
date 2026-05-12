"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadDormConnectFile, uploadDormConnectFiles } from "@/lib/upload-file-client";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

const MapLocationPicker = dynamic(
  () =>
    import("@/components/maps/map-location-picker").then((m) => ({
      default: m.MapLocationPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[240px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  }
);

type Property = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  propertyType: string;
  description: string;
  totalRooms: number | null;
  maxOccupancyCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  operationalStatus: string;
  createdAt: string;
};

const emptyForm = () => ({
  name: "",
  propertyType: "Dormitory" as "Dormitory" | "Boarding House",
  description: "",
  address: "",
  city: "",
  contactPhone: "",
  contactEmail: "",
  totalRooms: "" as string,
  maxOccupancyCapacity: "" as string,
  latitude: null as number | null,
  longitude: null as number | null,
  coverImageUrl: null as string | null,
  galleryImageUrls: [] as string[],
});

export default function LandlordPropertiesPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/properties", {
        credentials: "include",
      });
      const data = (await res.json()) as { properties?: Property[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setItems(data.properties ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setCoverFile(null);
    setGalleryFiles([]);
    setModalOpen(true);
  };

  const openEdit = (p: Property) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      propertyType: p.propertyType as "Dormitory" | "Boarding House",
      description: p.description ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      contactPhone: p.contactPhone ?? "",
      contactEmail: p.contactEmail ?? "",
      totalRooms: p.totalRooms != null ? String(p.totalRooms) : "",
      maxOccupancyCapacity:
        p.maxOccupancyCapacity != null ? String(p.maxOccupancyCapacity) : "",
      latitude: p.latitude,
      longitude: p.longitude,
      coverImageUrl: p.coverImageUrl,
      galleryImageUrls: [...p.galleryImageUrls],
    });
    setCoverFile(null);
    setGalleryFiles([]);
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setError("Property name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let cover = form.coverImageUrl;
      if (coverFile) {
        cover = await uploadDormConnectFile(coverFile);
      }
      let gallery = [...form.galleryImageUrls];
      if (galleryFiles.length > 0) {
        const up = await uploadDormConnectFiles(galleryFiles);
        gallery = [...gallery, ...up];
      }

      const payload = {
        name: form.name.trim(),
        propertyType: form.propertyType,
        description: form.description.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        totalRooms: form.totalRooms.trim()
          ? Number(form.totalRooms)
          : null,
        maxOccupancyCapacity: form.maxOccupancyCapacity.trim()
          ? Number(form.maxOccupancyCapacity)
          : null,
        latitude: form.latitude,
        longitude: form.longitude,
        coverImageUrl: cover,
        galleryImageUrls: gallery,
      };

      if (editingId) {
        const res = await fetch(`/api/landlord/properties/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Save failed");
      } else {
        const res = await fetch("/api/landlord/properties", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(j.error ?? "Create failed");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removeProperty = async (p: Property) => {
    if (
      !window.confirm(
        `Delete “${p.name}”? Rooms under this property will be removed if allowed.`
      )
    )
      return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/landlord/properties/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground">
            Add dormitories or boarding houses, set contact details, upload images,
            and pin the exact location on the map (OpenStreetMap).
          </p>
          <Link
            href="/landlord/rooms"
            className="mt-1 inline-block text-xs text-primary underline"
          >
            Manage rooms per property
          </Link>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={openAdd}
          disabled={loading || saving}
        >
          <Plus className="h-3 w-3" />
          Add property
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Your properties</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <Table bordered={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Map pin</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-xs text-muted-foreground"
                    >
                      No properties yet. Add your first dorm or boarding house.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">
                        {p.name}
                        <div className="text-[0.65rem] text-muted-foreground font-normal">
                          {[p.address, p.city].filter(Boolean).join(", ") || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[0.65rem]">
                          {p.propertyType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.latitude != null && p.longitude != null
                          ? `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`
                          : "Not set"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem]"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[0.7rem] text-red-600"
                            onClick={() => void removeProperty(p)}
                            disabled={saving}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8">
          <Card className="my-auto w-full max-w-lg border border-gray-300 bg-white">
            <CardHeader className="border-b bg-muted/40">
              <CardTitle className="text-base">
                {editingId ? "Edit property" : "Add property"}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[min(90vh,800px)] space-y-3 overflow-y-auto pt-4 text-xs">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-medium text-slate-800">Property name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Property type</label>
                  <select
                    className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-xs"
                    value={form.propertyType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        propertyType: e.target.value as typeof f.propertyType,
                      }))
                    }
                  >
                    <option value="Dormitory">Dormitory</option>
                    <option value="Boarding House">Boarding House</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Contact number</label>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contactPhone: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-medium text-slate-800">Address</label>
                  <Input
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">City / area</label>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Contact email</label>
                  <Input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, contactEmail: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">Total rooms (optional)</label>
                  <Input
                    type="number"
                    min={0}
                    value={form.totalRooms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, totalRooms: e.target.value }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-800">
                    Max occupancy (optional)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={form.maxOccupancyCapacity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxOccupancyCapacity: e.target.value,
                      }))
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-medium text-slate-800">Description</label>
                  <Textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-800">
                  Pin location (click map)
                </label>
                <p className="text-[0.65rem] text-muted-foreground">
                  Uses OpenStreetMap tiles. Set the pin where your building entrance is.
                </p>
                <MapLocationPicker
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(lat, lng) =>
                    setForm((f) => ({ ...f, latitude: lat, longitude: lng }))
                  }
                  height={220}
                />
                <div className="flex gap-2 text-[0.65rem] text-muted-foreground">
                  <span>Lat: {form.latitude?.toFixed(6) ?? "—"}</span>
                  <span>Lng: {form.longitude?.toFixed(6) ?? "—"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-slate-800">Cover image</label>
                {form.coverImageUrl ? (
                  <p className="text-[0.65rem] break-all">{form.coverImageUrl}</p>
                ) : null}
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="text-xs"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-800">Gallery images</label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="text-xs"
                  onChange={(e) =>
                    setGalleryFiles(Array.from(e.target.files ?? []))
                  }
                />
                {form.galleryImageUrls.length > 0 && (
                  <p className="text-[0.65rem] text-muted-foreground">
                    {form.galleryImageUrls.length} image(s) saved. New uploads append.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void submit()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : editingId ? "Save changes" : "Create property"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
