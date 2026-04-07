"use client";

import { Suspense, useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, LogIn, Loader2, Eye, EyeOff } from "lucide-react";
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
import { cn } from "@/components/ui/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("error") === "forbidden") {
      setError(
        "You do not have access to that area. Sign in with an account that has permission."
      );
    }
  }, [searchParams]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirect?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      if (data.redirect) {
        const next = searchParams.get("next");
        const safeNext =
          next &&
          next.startsWith("/") &&
          !next.includes("..") &&
          next.startsWith(data.redirect)
            ? next
            : data.redirect;
        router.push(safeNext);
        router.refresh();
        return;
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 px-4">
      <div className="max-w-5xl w-full grid gap-10 lg:grid-cols-[1.2fr,1fr] items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-xs font-medium text-primary">
            <span className="mr-2 h-2 w-2 rounded-full bg-secondary" />
            USTP Dormitory & Boarding House Management
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-primary">
            DormConnect
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xl">
            Centralized, web-based platform for managing accredited dormitories and boarding houses
            for USTP students, landlords, and administrators.
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md text-xs sm:text-sm">
            <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
              <p className="font-semibold text-foreground">Role-based dashboards</p>
              <p className="mt-1 text-muted-foreground">
                After sign-in you are taken to the dashboard for your account role.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-3 sm:p-4 shadow-sm">
              <p className="font-semibold text-foreground">Accreditation workflows</p>
              <p className="mt-1 text-muted-foreground">
                Track accreditation, reservations, compliance, and announcements.
              </p>
            </div>
          </div>
        </div>

        <Card className={cn("w-full max-w-md mx-auto border-primary/10 shadow-lg shadow-primary/5")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LogIn className="h-4 w-4" />
              </span>
              Sign in to DormConnect
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Enter your email and password. You will be redirected to the correct dashboard based on
              your registered role. Only <strong>active</strong> accounts can sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@ustp.edu.ph"
                    autoComplete="email"
                    required
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full mt-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />
                    Signing in…
                  </>
                ) : (
                  "Login"
                )}
              </Button>

              <p className="text-[0.7rem] sm:text-xs text-muted-foreground text-center">
                Only users created in User Management can sign in. Pending or inactive accounts are
                blocked.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
