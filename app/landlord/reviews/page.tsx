"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Star } from "lucide-react";
import { cn } from "@/components/ui/utils";

type Review = {
  id: string;
  rating: number;
  title: string;
  comment: string;
  reviewedAt: string;
  studentName: string;
  roomId: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
};

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-slate-600">{rating}/5</span>
    </span>
  );
}

export default function LandlordReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/landlord/reviews", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reviews?: Review[];
        avgRating?: number | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
      setReviews(json.reviews ?? []);
      setAvgRating(json.avgRating ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReviews([]);
      setAvgRating(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter(
      (r) =>
        r.propertyName.toLowerCase().includes(q) ||
        r.roomNo.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q)
    );
  }, [reviews, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">View Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Student reviews for rooms in your dormitories and boarding houses.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total reviews
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : reviews.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-300 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Average rating
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold tabular-nums">
              {loading ? "—" : avgRating != null ? `${avgRating} ★` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-slate-800">
                Student reviews
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Submitted by students who booked a room at your properties.
              </p>
            </div>
            <Input
              placeholder="Search property, room, student, or review…"
              className="h-8 max-w-xs text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading reviews…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {reviews.length === 0
                ? "No student reviews yet. Reviews appear when tenants submit feedback from their Reviews page."
                : "No reviews match your search."}
            </p>
          ) : (
            filtered.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {review.propertyName} — Room {review.roomNo}
                      </p>
                      <Badge variant="outline" className="text-[0.65rem]">
                        {review.reviewedAt}
                      </Badge>
                    </div>
                    {review.propertyAddress ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {review.propertyAddress}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-600">
                      Review by{" "}
                      <span className="font-medium">{review.studentName}</span>
                    </p>
                  </div>
                  <StarsDisplay rating={review.rating} />
                </div>
                {review.title ? (
                  <p className="mt-3 text-sm font-medium text-slate-800">
                    {review.title}
                  </p>
                ) : null}
                <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">
                  {review.comment}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
