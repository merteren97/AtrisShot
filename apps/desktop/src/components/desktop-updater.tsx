"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle, RefreshCw, X } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Button } from "@/components/ui/button";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { useUiPreferences } from "@/lib/ui-preferences";

type UpdateState = "idle" | "available" | "downloading" | "installing" | "ready" | "error";

export function DesktopUpdater() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const updateRef = useRef<Update | null>(null);
  const { t } = useUiPreferences();

  useEffect(() => {
    if (
      !isNativeRuntime() ||
      window.location.pathname.includes("/overlay") ||
      window.location.pathname.includes("/capture-overlay")
    ) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void check()
        .then((update) => {
          if (cancelled || !update) return;
          updateRef.current = update;
          setVersion(update.version);
          setState("available");
        })
        .catch((reason) => {
          if (!cancelled) {
            setError(String(reason));
            setState("error");
          }
        });
    }, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    const update = updateRef.current;
    if (!update) return;
    setError("");
    setProgress(0);
    setState("downloading");
    let downloaded = 0;
    let total = 0;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) setProgress(Math.min(100, Math.round((downloaded / total) * 100)));
        } else if (event.event === "Finished") {
          setProgress(100);
          setState("installing");
        }
      });
      setState("ready");
    } catch (reason) {
      setError(String(reason));
      setState("error");
    }
  };

  if (state === "idle") return null;

  return (
    <aside className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-xl rounded-xl border bg-card/95 p-4 text-card-foreground shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {state === "downloading" || state === "installing" ? (
            <LoaderCircle className="h-5 w-5 animate-spin" />
          ) : state === "ready" ? (
            <RefreshCw className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {state === "ready" ? t("updateReady") : state === "error" ? t("updateFailed") : t("updateAvailable")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {state === "downloading"
              ? `${t("updateDownloading")} ${progress}%`
              : state === "installing"
                ? t("updateInstalling")
                : state === "error"
                  ? error
                  : t("updateAvailableDescription").replace("{version}", version)}
          </p>
          {(state === "downloading" || state === "installing") && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${state === "installing" ? 100 : progress}%` }} />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {state === "available" && <Button size="sm" onClick={() => void install()}>{t("installUpdate")}</Button>}
            {state === "ready" && <Button size="sm" onClick={() => void nativeRuntime.restartApplication()}>{t("restartToUpdate")}</Button>}
            {state === "error" && <Button size="sm" variant="outline" onClick={() => setState("idle")}>{t("dismiss")}</Button>}
          </div>
        </div>
        {(state === "available" || state === "error") && (
          <Button size="icon" variant="ghost" aria-label={t("dismiss")} onClick={() => setState("idle")}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
