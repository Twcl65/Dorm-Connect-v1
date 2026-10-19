"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [course, setCourse] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!profileFile) {
      setError("Profile picture is required.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.set("fullName", fullName);
      form.set("email", email);
      form.set("password", password);
      form.set("studentId", studentId);
      form.set("course", course);
      form.set("emergencyContactName", emergencyName);
      form.set("emergencyContactPhone", emergencyPhone);
      form.set("profileImage", profileFile);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirect?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4 py-10">
      <Card className="w-full max-w-lg border-primary/10 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            Student / tenant registration
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Create your DormConnect account. ICT will verify your details; you
            can browse accredited listings while pending, but booking opens only
            after verification.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                {error}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="password">Password (8+ characters)</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="course">Course</Label>
                <Input
                  id="course"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ecName">Emergency contact name</Label>
                <Input
                  id="ecName"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ecPhone">Emergency contact phone</Label>
                <Input
                  id="ecPhone"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="profile">Profile picture</Label>
                <Input
                  id="profile"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) =>
                    setProfileFile(e.target.files?.[0] ?? null)
                  }
                  disabled={loading}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                  Creating account…
                </>
              ) : (
                "Register"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
