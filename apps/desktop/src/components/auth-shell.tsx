"use client";

import { useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShotWorkspace } from "@/components/shot-workspace";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useUiPreferences } from "@/lib/ui-preferences";
import { AtrisShotMark } from "@/components/brand/atris-shot-mark";
import { LanguagePicker } from "@/components/language-picker";

const REMEMBER_SESSION_KEY = "atrisshot-remember-session";

export function AuthShell() {
  const auth = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { t } = useUiPreferences();

  useEffect(() => {
    localStorage.setItem("atrisshot-onboarding-complete", "true");
    setRememberSession(localStorage.getItem(REMEMBER_SESSION_KEY) !== "false");
  }, []);

  if (auth.checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-5 w-5 animate-spin" /> {t("checkingSession")}
        </div>
      </main>
    );
  }

  if (auth.state === "authorized") {
    return <ShotWorkspace session={auth.session} onLogout={() => void auth.logout()} />;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await auth.login(email, password, rememberSession);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t("loginFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r bg-card p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <AtrisShotMark className="h-10 w-10 rounded-xl" />
          <span className="font-semibold">AtrisShot</span>
        </div>
        <div className="max-w-xl">
          <h1 className="text-4xl font-semibold tracking-tight">{t("localPromise")}</h1>
          <p className="mt-4 leading-7 text-muted-foreground">{t("localPromiseDescription")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("desktopTagline")}</p>
      </section>
      <section className="relative flex items-center justify-center p-6">
        <div className="absolute right-6 top-6">
          <LanguagePicker />
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <KeyRound className="h-5 w-5" />
            </div>
            <CardTitle>{t("signInTitle")}</CardTitle>
            <CardDescription>{t("signInDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block space-y-2 text-sm font-medium">
                {t("email")}
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                {t("password")}
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  checked={rememberSession}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setRememberSession(checked);
                    localStorage.setItem(REMEMBER_SESSION_KEY, String(checked));
                  }}
                />
                {t("rememberMe")}
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" disabled={submitting}>
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t("signIn")}
              </Button>
            </form>
            <div className="mt-5 flex items-start gap-2 border-t pt-4 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              {t(rememberSession ? "sessionVault" : "sessionOnly")}
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
