"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Star } from "lucide-react";
import { cn } from "@/components/ui/utils";

type ReviewableRoom = {
  roomId: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
  reservationStatus: string;
  existingReview: {
    id: string;
    rating: number;
    title: string;
    comment: string;
    reviewedAt: string | null;
  } | null;
};

type MyReview = {
  roomId: string;
  roomNo: string;
  propertyName: string;
  propertyAddress: string | null;
  reservationStatus: string;
  id: string;
  rating: number;
  title: string;
  comment: string;
  reviewedAt: string | null;
};

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`}
        >
          <Star
            className={cn(
              "h-7 w-7",
              star <= active
                ? "fill-amber-400 text-amber-400"
                : "text-slate-300"
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {value > 0 ? `${value} / 5` : "Select rating"}
      </span>
    </div>
  );
}

function StarsDisplay({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-amber-400 text-amber-400" : "text-slate-300"
          )}
        />
      ))}
    </span>
  );
}

export default function StudentReviewsPage() {
  const [reviewableRooms, setReviewableRooms] = useState<ReviewableRoom[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [roomId, setRoomId] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/reviews/mine", {
        credentials: "include",
      });
      const json = (await res.json()) as {
        reviewableRooms?: ReviewableRoom[];
        myReviews?: MyReview[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
      setReviewableRooms(json.reviewableRooms ?? []);
      setMyReviews(json.myReviews ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setReviewableRooms([]);
      setMyReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRoom = useMemo(
    () => reviewableRooms.find((r) => r.roomId === roomId) ?? null,
    [reviewableRooms, roomId]
  );

  const resetForm = () => {
    setRoomId("");
    setRating(0);
    setTitle("");
    setComment("");
    setSubmitError(null);
  };

  const startEdit = (review: MyReview) => {
    setRoomId(review.roomId);
    setRating(review.rating);
    setTitle(review.title);
    setComment(review.comment);
    setSubmitError(null);
    document.getElementById("review-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const submitReview = async () => {
    setSubmitError(null);
    if (!roomId) {
      setSubmitError("Select the dormitory / room you booked.");
      return;
    }
    if (rating < 1) {
      setSubmitError("Please select a star rating (1–5).");
      return;
    }
    if (!comment.trim()) {
      setSubmitError("Please write a review description.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/student/reviews", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          rating,
          title: title.trim(),
          comment: comment.trim(),
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to save review");
      resetForm();
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to save review");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Share your experience for dormitories you have booked. Your rating and
            comments help other USTP students choose housing.
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

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {loadError}
        </div>
      )}

      <Card id="review-form" className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Write a review
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Only rooms from your active reservations can be reviewed. You can
            update your review anytime.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your bookings…
            </div>
          ) : reviewableRooms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no active reservations yet. Book a dormitory from{" "}
              <span className="font-medium text-slate-700">Browse Dormitories</span>{" "}
              to leave a review.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="review-room">Dormitory / room</Label>
                <select
                  id="review-room"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={roomId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setRoomId(id);
                    const room = reviewableRooms.find((r) => r.roomId === id);
                    if (room?.existingReview) {
                      setRating(room.existingReview.rating);
                      setTitle(room.existingReview.title);
                      setComment(room.existingReview.comment);
                    } else {
                      setRating(0);
                      setTitle("");
                      setComment("");
                    }
                  }}
                >
                  <option value="">Select a booked room…</option>
                  {reviewableRooms.map((r) => (
                    <option key={r.roomId} value={r.roomId}>
                      {r.propertyName} — Room {r.roomNo}
                      {r.existingReview ? " (reviewed)" : ""}
                    </option>
                  ))}
                </select>
                {selectedRoom && (
                  <p className="text-xs text-muted-foreground">
                    Reservation:{" "}
                    <Badge variant="outline" className="text-[0.65rem]">
                      {selectedRoom.reservationStatus}
                    </Badge>
                    {selectedRoom.propertyAddress
                      ? ` · ${selectedRoom.propertyAddress}`
                      : null}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Star rating</Label>
                <StarRating value={rating} onChange={setRating} disabled={saving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-title">Review title</Label>
                <Input
                  id="review-title"
                  placeholder="e.g. Clean rooms and friendly landlord"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={saving}
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-comment">Description</Label>
                <Textarea
                  id="review-comment"
                  placeholder="Describe your stay — cleanliness, safety, amenities, location, and overall experience…"
                  className="min-h-[120px] text-sm"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={saving}
                  maxLength={2000}
                />
              </div>

              {submitError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={saving || !roomId}
                  onClick={() => void submitReview()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : selectedRoom?.existingReview ? (
                    "Update review"
                  ) : (
                    "Submit review"
                  )}
                </Button>
                {(roomId || rating > 0 || title || comment) && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving}
                    onClick={resetForm}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-300 bg-white">
        <CardHeader className="pb-3 border-b bg-muted/40">
          <CardTitle className="text-sm font-semibold text-slate-800">
            My reviews
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Reviews you have submitted for your booked dormitories.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : myReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have not submitted any reviews yet.
            </p>
          ) : (
            myReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {review.propertyName} — Room {review.roomNo}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StarsDisplay rating={review.rating} />
                      {review.reviewedAt && (
                        <span className="text-xs text-muted-foreground">
                          {review.reviewedAt}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-[0.7rem]"
                    onClick={() => startEdit(review)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>
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
