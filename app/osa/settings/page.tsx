"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, X } from "lucide-react";

export default function OsaSettingsPage() {
  const [signatoryConfig, setSignatoryConfig] = useState<{
    signatory_name: string;
    signatory_title: string;
    campus: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/osa/settings", { credentials: "include" });
      const json = (await res.json()) as {
        config?: { signatory_name: string; signatory_title: string; campus: string };
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setSignatoryConfig(json.config ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setSignatoryConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!signatoryConfig) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/osa/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatory_name: signatoryConfig.signatory_name,
          signatory_title: signatoryConfig.signatory_title,
          campus: signatoryConfig.campus,
        }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(j.error ?? "Failed to save");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">OSA Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage OSA configuration, signatory names, and accommodation settings.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : signatoryConfig ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Sign Certificate Name</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void load()}
              >
                <X className="h-3 w-3 mr-1" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signatoryName">Signatory Name</Label>
              <Input
                id="signatoryName"
                value={signatoryConfig.signatory_name}
                onChange={(e) =>
                  setSignatoryConfig({
                    ...signatoryConfig,
                    signatory_name: e.target.value,
                  })
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatoryTitle">Title</Label>
              <Input
                id="signatoryTitle"
                value={signatoryConfig.signatory_title}
                onChange={(e) =>
                  setSignatoryConfig({
                    ...signatoryConfig,
                    signatory_title: e.target.value,
                  })
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campus">Campus</Label>
              <Input
                id="campus"
                value={signatoryConfig.campus}
                onChange={(e) =>
                  setSignatoryConfig({
                    ...signatoryConfig,
                    campus: e.target.value,
                  })
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => void load()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sign Certificate Name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs text-muted-foreground">
            <p>No signatory configuration found.</p>
            <p className="text-[0.7rem]">
              Ask an OSA administrator to configure the sign certificate name.
              Once configured, this page will show the editable fields above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
