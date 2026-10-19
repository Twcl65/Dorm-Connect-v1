import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X, Check } from "lucide-react";

type TermsContent = {
  overview: string;
  paymentAndRemoval: string;
  consequences: string;
  examples: string;
};

type TermsData = {
  title: string;
  content: TermsContent;
};

type Props = {
  open: boolean;
  propertyId?: string | null;
  onOpenChange: (open: boolean) => void;
};

export function TermsDialog({ open, propertyId, onOpenChange }: Props) {
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedTimeout, setSavedTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, propertyId]);

  const load = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      let url = "/api/terms";
      if (propertyId) {
        url += `?propertyId=${propertyId}`;
      }
      const res = await fetch(url, { credentials: "include" });
      const data = (await res.json()) as { terms?: TermsData; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load terms");
      setTerms(data.terms ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load terms");
    } finally {
      setLoading(false);
    }
  };

  const updateContent = (field: keyof TermsContent, value: string) => {
    if (!terms) return;
    setTerms({
      ...terms,
      content: {
        overview: terms.content?.overview ?? "",
        paymentAndRemoval: terms.content?.paymentAndRemoval ?? "",
        consequences: terms.content?.consequences ?? "",
        examples: terms.content?.examples ?? "",
        [field]: value,
      },
    });
    setSaved(false);
    setDirty(true);
  };

  const save = async () => {
    if (!terms) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/terms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: terms.title,
          content: terms.content,
          propertyId: propertyId ?? null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save terms");
      setSuccess("Terms & conditions saved successfully.");
      setSaved(true);
      setDirty(false);
      // Auto-revert to "Save Terms" after 3 seconds
      if (savedTimeout) clearTimeout(savedTimeout);
      const timeout = setTimeout(() => setSaved(false), 3000);
      setSavedTimeout(timeout);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save terms");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between rounded-t">
          <div>
            <CardTitle className="text-xl">Terms &amp; Conditions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Edit the terms and conditions displayed to students/tenants on the
              web and mobile app.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-1 h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {success}
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <Input
              value={terms?.title ?? ""}
              onChange={(e) => {
                if (!terms) return;
                setTerms({ ...terms, title: e.target.value });
              }}
              className="text-xs"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Overview
            </label>
            <Textarea
              value={terms?.content.overview ?? ""}
              onChange={(e) => updateContent("overview", e.target.value)}
              className="min-h-[100px] text-xs"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Payment &amp; Removal
            </label>
            <Textarea
              value={terms?.content.paymentAndRemoval ?? ""}
              onChange={(e) => updateContent("paymentAndRemoval", e.target.value)}
              className="min-h-[100px] text-xs"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Consequences
            </label>
            <Textarea
              value={terms?.content.consequences ?? ""}
              onChange={(e) => updateContent("consequences", e.target.value)}
              className="min-h-[100px] text-xs"
              placeholder="E.g. Account suspension, removal from dormitory, reporting to OSA..."
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-700">
              Examples
            </label>
            <Textarea
              value={terms?.content.examples ?? ""}
              onChange={(e) => updateContent("examples", e.target.value)}
              className="min-h-[100px] text-xs"
              placeholder="E.g. Smoking in non-designated areas may result in a fine..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  Save Terms
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
