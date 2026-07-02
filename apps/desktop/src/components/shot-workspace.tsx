"use client";

import { useCallback, useEffect, useRef, useState, type MouseEventHandler } from "react";
import {
  ArrowUpRight,
  Circle,
  Clipboard,
  Copy,
  Edit3,
  ExternalLink,
  FolderOpen,
  History,
  Home,
  Image,
  Keyboard,
  Layers,
  LogOut,
  Minus,
  MousePointer2,
  PenLine,
  RectangleHorizontal,
  Scissors,
  Settings,
  Trash2,
  Type,
  UserRound,
} from "lucide-react";
import type { CaptureRequest, DisplayInfo, ShotAnnotation, ShotHistoryEntry, ShotSettings } from "@atris-shot/shot-core";
import type { ShotSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsPanel } from "@/components/settings-panel";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { addPreviewShot, clearShotHistory, deleteShotHistoryEntry, loadShotHistory } from "@/lib/shot-history";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

const atrisHubUrl = (process.env.NEXT_PUBLIC_ATRIS_HUB_URL || "https://atrishub.com").replace(/\/$/, "");

const sectionAfterCapture = (action: ShotSettings["postCaptureAction"]) =>
  action === "open-editor" ? "editor" : action === "save-silently" ? "capture" : "history";

function useShotDataUrl(path?: string | null) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    if (!path || !isNativeRuntime()) return;
    void nativeRuntime
      .readShotDataUrl(path)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { dataUrl, failed };
}

function ShotImage({
  path,
  className,
  loading,
}: {
  path?: string | null;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const { dataUrl, failed } = useShotDataUrl(path);
  if (!path || failed) return <Image className="h-5 w-5 text-muted-foreground" />;
  if (!dataUrl) return <div className="h-full w-full animate-pulse bg-muted" aria-hidden="true" />;
  return <img src={dataUrl} alt="" className={className} loading={loading} draggable={false} />;
}

export function ShotWorkspace({ session, onLogout }: { session: ShotSession; onLogout: () => void }) {
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<"capture" | "history" | "editor" | "settings">("capture");
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ShotHistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ShotHistoryEntry | null>(null);
  const [missingEntryIds, setMissingEntryIds] = useState<Set<string>>(() => new Set());
  const [annotations, setAnnotations] = useState<ShotAnnotation[]>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Ready");

  const refreshMissingEntries = useCallback(async (entries: ShotHistoryEntry[]) => {
    if (!isNativeRuntime()) {
      setMissingEntryIds(new Set());
      return;
    }
    const checks = await Promise.all(
      entries.map(async (entry) => {
        const path = entry.editedPath || entry.originalPath;
        const exists = path ? await nativeRuntime.pathExists(path) : false;
        return [entry.id, !exists] as const;
      }),
    );
    setMissingEntryIds(new Set(checks.filter(([, missing]) => missing).map(([id]) => id)));
  }, []);

  const refreshHistory = useCallback(async () => {
    const entries = await loadShotHistory();
    setHistoryEntries(entries);
    void refreshMissingEntries(entries);
    if (!selectedEntry && entries[0]) setSelectedEntry(entries[0]);
  }, [refreshMissingEntries, selectedEntry]);

  const refreshDisplays = useCallback(async () => {
    try {
      setDisplays(await nativeRuntime.listDisplays());
    } catch (reason) {
      setError(String(reason));
    }
  }, []);

  useEffect(() => {
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
    void refreshDisplays();
    void refreshHistory();
    if (!isNativeRuntime()) return;
    let unlistenShot: (() => void) | undefined;
    let unlistenEdit: (() => void) | undefined;
    void nativeRuntime.onShotCaptured((entry) => {
      setHistoryEntries((current) => {
        const next = [entry, ...current.filter((item) => item.id !== entry.id)];
        void refreshMissingEntries(next);
        return next;
      });
      setSelectedEntry(entry);
      setActiveSection(sectionAfterCapture(settings.postCaptureAction));
    }).then((dispose) => {
      unlistenShot = dispose;
    });
    void nativeRuntime.onEditShotRequested((entry) => {
      setHistoryEntries((current) => {
        const next = [entry, ...current.filter((item) => item.id !== entry.id)];
        void refreshMissingEntries(next);
        return next;
      });
      setSelectedEntry(entry);
      setActiveSection("editor");
    }).then((dispose) => {
      unlistenEdit = dispose;
    });
    return () => {
      unlistenShot?.();
      unlistenEdit?.();
    };
  }, [refreshDisplays, refreshHistory, refreshMissingEntries, settings.postCaptureAction]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountMenuOpen]);

  const capture = async (request: CaptureRequest) => {
    setCapturing(true);
    setError("");
    setStatus("Capturing...");
    try {
      if (!isNativeRuntime()) {
        const preview = createPreviewEntry(request, displays[0]);
        const next = await addPreviewShot(preview, settings.historyLimit);
        setHistoryEntries(next);
        void refreshMissingEntries(next);
        setSelectedEntry(preview);
        setActiveSection("history");
        setStatus("Preview shot created");
        return;
      }
      const result = await nativeRuntime.captureShot({
        ...request,
        saveFolder: settings.saveFolder,
        clipboardMode: settings.clipboardMode,
        postCaptureAction: settings.postCaptureAction,
        overlayCorner: settings.overlayCorner,
        includeCursor: settings.includeCursor,
        captureDelayMs: settings.captureDelayMs,
        historyLimit: settings.historyLimit,
      });
      setHistoryEntries((current) => {
        const next = [result.entry, ...current.filter((entry) => entry.id !== result.entry.id)];
        void refreshMissingEntries(next);
        return next;
      });
      setSelectedEntry(result.entry);
      setActiveSection(sectionAfterCapture(settings.postCaptureAction));
      setStatus(result.copiedPath ? "Path copied" : result.copiedImage ? "Image copied" : "Saved locally");
    } catch (reason) {
      setError(String(reason));
      setStatus("Capture failed");
    } finally {
      setCapturing(false);
    }
  };

  const applyEditor = async () => {
    if (!selectedEntry) return;
    if (missingEntryIds.has(selectedEntry.id)) {
      setStatus("Local file missing");
      return;
    }
    if (isNativeRuntime()) {
      const next = await nativeRuntime.applyAnnotations(selectedEntry.id, JSON.stringify(annotations));
      setSelectedEntry(next);
      setHistoryEntries((current) => current.map((entry) => (entry.id === next.id ? next : entry)));
      void refreshMissingEntries([next, ...historyEntries.filter((entry) => entry.id !== next.id)]);
      await refreshHistory();
    } else {
      setSelectedEntry({ ...selectedEntry, annotationsCount: annotations.length });
    }
    setStatus("Annotations applied");
  };

  const deleteHistoryEntry = async (entry: ShotHistoryEntry) => {
    const next = await deleteShotHistoryEntry(entry.id);
    setHistoryEntries(next);
    void refreshMissingEntries(next);
    if (selectedEntry?.id === entry.id) {
      setSelectedEntry(next[0] ?? null);
      setAnnotations([]);
    }
  };

  const clearHistoryEntries = async () => {
    const next = await clearShotHistory();
    setHistoryEntries(next);
    setMissingEntryIds(new Set());
    setSelectedEntry(null);
    setAnnotations([]);
  };

  const handleLocalDataRemoved = useCallback(() => {
    setHistoryEntries([]);
    setMissingEntryIds(new Set());
    setSelectedEntry(null);
    setAnnotations([]);
    setSettings(DEFAULT_SHOT_SETTINGS);
    setStatus("Local data removed");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("atrisshot-onboarding-complete");
    }
    onLogout();
  }, [onLogout]);

  const activeDisplay = displays[0];

  return (
    <main className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-screen w-16 shrink-0 flex-col border-r bg-card px-2 py-4 lg:w-56 lg:px-3">
        <nav className="space-y-1" aria-label="Primary navigation">
          {[
            { icon: Home, label: "Capture", section: "capture" as const },
            { icon: History, label: "History", section: "history" as const },
            { icon: Edit3, label: "Editor", section: "editor" as const },
            { icon: Settings, label: "Settings", section: "settings" as const },
          ].map(({ icon: NavIcon, label, section }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveSection(section)}
              aria-current={activeSection === section ? "page" : undefined}
              aria-label={label}
              className={`flex h-9 w-full items-center justify-center gap-3 rounded-md px-2 text-sm lg:justify-start lg:px-3 ${
                activeSection === section
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <NavIcon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>
        <div ref={accountMenuRef} className="relative mt-auto border-t pt-3">
          {accountMenuOpen && (
            <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <AccountAvatar session={session} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session.user?.name || session.user?.username}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user?.email}</p>
                </div>
              </div>
              <div className="my-1 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
                <span>{session.offline ? "Offline grace" : "Account"}</span>
                <Badge>{session.membership.plan}</Badge>
              </div>
              <a href={atrisHubUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent">
                <span>Open AtrisHub</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
              <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10" onClick={onLogout}>
                <span>Sign out</span>
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
          <button type="button" aria-expanded={accountMenuOpen} aria-label="Account menu" onClick={() => setAccountMenuOpen((open) => !open)} className="flex w-full items-center justify-center gap-3 rounded-xl px-1 py-2 text-left hover:bg-accent/60 lg:justify-start lg:px-2">
            <AccountAvatar session={session} />
            <div className="hidden min-w-0 flex-1 lg:block">
              <div className="truncate text-sm font-semibold">{session.user?.name || session.user?.username}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{session.membership.plan}</div>
            </div>
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6">
          <div>
            <h1 className="text-sm font-semibold">
              {activeSection === "capture" ? "Capture" : activeSection === "history" ? "History" : activeSection === "editor" ? "Editor" : "Settings"}
            </h1>
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
          <Badge>{settings.shortcut.replaceAll("+", " + ")}</Badge>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeSection === "settings" ? (
            <SettingsPanel onSettingsChanged={setSettings} onLocalDataRemoved={handleLocalDataRemoved} />
          ) : activeSection === "history" ? (
            <HistoryPanel
              entries={historyEntries}
              selected={selectedEntry}
              missingEntryIds={missingEntryIds}
              onSelect={setSelectedEntry}
              onEdit={(entry) => {
                setSelectedEntry(entry);
                setActiveSection("editor");
              }}
              onCopyPath={(entry) => void copyPath(entry.editedPath || entry.originalPath)}
              onReveal={(entry) => void reveal(entry.editedPath || entry.originalPath)}
              onDelete={(entry) => void deleteHistoryEntry(entry)}
              onClear={() => void clearHistoryEntries()}
            />
          ) : activeSection === "editor" ? (
            <EditorPanel
              entry={selectedEntry}
              fileMissing={Boolean(selectedEntry && missingEntryIds.has(selectedEntry.id))}
              annotations={annotations}
              onAnnotationsChange={setAnnotations}
              onApply={() => void applyEditor()}
            />
          ) : (
            <CapturePanel
              displays={displays}
              activeDisplay={activeDisplay}
              capturing={capturing}
              error={error}
              settings={settings}
              onRefreshDisplays={() => void refreshDisplays()}
              onCaptureDisplay={() => void capture({ mode: "display", displayId: activeDisplay?.id })}
              onCaptureRegion={() => {
                if (isNativeRuntime()) void nativeRuntime.showCaptureOverlay();
                else {
                  void capture({
                    mode: "region",
                    region: {
                      displayId: activeDisplay?.id || "primary",
                      x: 120,
                      y: 120,
                      width: Math.min(960, activeDisplay?.width || 960),
                      height: Math.min(540, activeDisplay?.height || 540),
                    },
                  });
                }
              }}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function CapturePanel({
  displays,
  activeDisplay,
  capturing,
  error,
  settings,
  onRefreshDisplays,
  onCaptureDisplay,
  onCaptureRegion,
}: {
  displays: DisplayInfo[];
  activeDisplay?: DisplayInfo;
  capturing: boolean;
  error: string;
  settings: ShotSettings;
  onRefreshDisplays: () => void;
  onCaptureDisplay: () => void;
  onCaptureRegion: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Capture anything on screen</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Press the global shortcut to capture the focused window or current screen, then drag when you need an exact region.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRefreshDisplays}>Refresh screen info</Button>
          <Button onClick={onCaptureDisplay} disabled={capturing}>
            <Image className="h-4 w-4" /> Capture current screen
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Layers className="h-4 w-4" />Current screen</CardTitle>
            <CardDescription>The overlay opens on the focused window's screen when the packaged app can detect it.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video overflow-hidden rounded-lg border bg-muted/40">
              <div className="absolute inset-6 rounded-lg border-2 border-dashed border-primary/70 bg-background/80 shadow-sm">
                <div className="flex h-full items-center justify-center text-center">
                  <div>
                    <p className="font-medium">{activeDisplay?.name || "Current screen"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeDisplay ? `${activeDisplay.width} x ${activeDisplay.height}` : "Screen metadata will appear here"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fast actions</CardTitle>
            <CardDescription>Default output follows your local settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionRow icon={MousePointer2} title="Focused capture" description="Shortcut opens the selector on the active screen and captures the focused window on click." value={settings.shortcut} />
            <ActionRow icon={RectangleHorizontal} title="Region capture" description="Drag inside the overlay when you need an exact crop." value="Overlay" />
            <ActionRow icon={Clipboard} title="Clipboard" description="Current output mode." value={settings.clipboardMode} />
            <Button className="w-full" variant="outline" onClick={onCaptureRegion} disabled={capturing}>
              <Scissors className="h-4 w-4" /> Open overlay
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Local history", "Saved screenshots remain on this device."],
          ["Corner overlay", `Result preview opens at ${settings.overlayCorner.replace("-", " ")}.`],
          ["Editor ready", "Shapes, arrows, pen, text, and blur controls are available."],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="text-sm">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryPanel({
  entries,
  selected,
  missingEntryIds,
  onSelect,
  onEdit,
  onCopyPath,
  onReveal,
  onDelete,
  onClear,
}: {
  entries: ShotHistoryEntry[];
  selected: ShotHistoryEntry | null;
  missingEntryIds: Set<string>;
  onSelect: (entry: ShotHistoryEntry) => void;
  onEdit: (entry: ShotHistoryEntry) => void;
  onCopyPath: (entry: ShotHistoryEntry) => void;
  onReveal: (entry: ShotHistoryEntry) => void;
  onDelete: (entry: ShotHistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Screenshot history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Local previews, paths, and edit state for recent screenshots.</p>
        </div>
        <Button variant="outline" disabled={!entries.length} onClick={onClear}>
          <Trash2 className="h-4 w-4" /> Clear list
        </Button>
      </div>

      {entries.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => {
            const isMissing = missingEntryIds.has(entry.id);
            return (
              <article key={entry.id} className={`overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:border-primary/40 ${selected?.id === entry.id ? "border-primary" : ""}`}>
                <div className="aspect-video overflow-hidden rounded-t-lg border-b bg-muted/40">
                  <button type="button" onClick={() => onSelect(entry)} className="block h-full w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                    {entry.thumbnailPath && !isMissing ? (
                      <ShotImage path={entry.thumbnailPath} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4">
                        <div className="flex h-full w-full items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                          {isMissing ? "Local file missing" : `${entry.width} x ${entry.height}`}
                        </div>
                      </div>
                    )}
                  </button>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.displayName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge>{entry.mode}</Badge>
                      {isMissing && <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Missing</Badge>}
                    </div>
                  </div>
                  <p className="truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{entry.editedPath || entry.originalPath}</p>
                  <Button type="button" variant="outline" className="w-full justify-start" onClick={() => onSelect(entry)}>
                    Select screenshot
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <IconAction label="Edit" icon={Edit3} disabled={isMissing} onClick={() => onEdit(entry)} />
                    <IconAction label="Copy path" icon={Copy} onClick={() => onCopyPath(entry)} />
                    <IconAction label="Reveal" icon={FolderOpen} disabled={isMissing} onClick={() => onReveal(entry)} />
                    <IconAction label="Delete" icon={Trash2} onClick={() => onDelete(entry)} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
            <Image className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold">No screenshots yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Your recent screenshots will appear here after capture.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditorPanel({
  entry,
  fileMissing,
  annotations,
  onAnnotationsChange,
  onApply,
}: {
  entry: ShotHistoryEntry | null;
  fileMissing: boolean;
  annotations: ShotAnnotation[];
  onAnnotationsChange: (annotations: ShotAnnotation[]) => void;
  onApply: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [activeTool, setActiveTool] = useState<ShotAnnotation["tool"]>("rectangle");
  const [draftColor, setDraftColor] = useState("#0ea5e9");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [textDraft, setTextDraft] = useState("Note");
  const [fontSize, setFontSize] = useState(24);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editInteraction, setEditInteraction] = useState<{
    id: string;
    mode: "move" | "resize";
    start: { x: number; y: number };
    originalPoints: Array<{ x: number; y: number }>;
  } | null>(null);
  const imagePath = entry ? entry.editedPath || entry.originalPath : "";
  const { dataUrl: imageUrl, failed: imageFailed } = useShotDataUrl(imagePath);

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !entry) return null;
    const x = Math.max(0, Math.min(entry.width, ((event.clientX - rect.left) / rect.width) * entry.width));
    const y = Math.max(0, Math.min(entry.height, ((event.clientY - rect.top) / rect.height) * entry.height));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;

  if (entry && fileMissing) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center text-center">
            <Image className="h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold">Local file missing</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              This history record still exists, but the screenshot file is no longer available on this device.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!entry) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if ((event.target as HTMLElement).closest("[data-editor-handle]") && selectedAnnotation) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setEditInteraction({ id: selectedAnnotation.id, mode: "resize", start: point, originalPoints: selectedAnnotation.points });
      return;
    }
    const hit = findAnnotationAtPoint(annotations, point);
    if (hit) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setSelectedAnnotationId(hit.id);
      setEditInteraction({ id: hit.id, mode: "move", start: point, originalPoints: hit.points });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const id = crypto.randomUUID();
    const annotation: ShotAnnotation = {
      id,
      tool: activeTool,
      color: activeTool === "blur" ? "#64748b" : draftColor,
      strokeWidth: activeTool === "text" ? 1 : strokeWidth,
      points: activeTool === "pen" ? [point] : [point, point],
      text: activeTool === "text" ? textDraft.trim() || "Note" : undefined,
      fontSize: activeTool === "text" ? fontSize : undefined,
    };
    onAnnotationsChange([...annotations, annotation]);
    setDrawingId(id);
    setSelectedAnnotationId(id);
  };

  const continueDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (editInteraction) {
      const point = pointFromEvent(event);
      if (!point) return;
      const dx = point.x - editInteraction.start.x;
      const dy = point.y - editInteraction.start.y;
      onAnnotationsChange(
        annotations.map((annotation) => {
          if (annotation.id !== editInteraction.id) return annotation;
          if (editInteraction.mode === "resize") {
            const first = editInteraction.originalPoints[0] || point;
            return {
              ...annotation,
              points: [first, clampPoint({ x: point.x, y: point.y }, entry)],
            };
          }
          return {
            ...annotation,
            points: editInteraction.originalPoints.map((item) => clampPoint({ x: item.x + dx, y: item.y + dy }, entry)),
          };
        }),
      );
      return;
    }
    if (!drawingId) return;
    const point = pointFromEvent(event);
    if (!point) return;
    onAnnotationsChange(
      annotations.map((annotation) => {
        if (annotation.id !== drawingId) return annotation;
        if (annotation.tool === "pen") return { ...annotation, points: [...annotation.points, point] };
        return { ...annotation, points: [annotation.points[0] || point, point] };
      }),
    );
  };

  const finishDrawing = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drawingId && !editInteraction) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDrawingId(null);
    setEditInteraction(null);
  };

  const undo = () => onAnnotationsChange(annotations.slice(0, -1));
  const clear = () => {
    onAnnotationsChange([]);
    setSelectedAnnotationId(null);
  };
  const deleteSelected = () => {
    if (!selectedAnnotationId) return;
    onAnnotationsChange(annotations.filter((annotation) => annotation.id !== selectedAnnotationId));
    setSelectedAnnotationId(null);
  };
  useEffect(() => {
    setDrawingId(null);
    setSelectedAnnotationId(null);
    setEditInteraction(null);
    onAnnotationsChange([]);
  }, [entry?.id, onAnnotationsChange]);

  const tools: Array<[ShotAnnotation["tool"], typeof RectangleHorizontal, string]> = [
    ["rectangle", RectangleHorizontal, "Rectangle"],
    ["ellipse", Circle, "Ellipse"],
    ["line", Minus, "Line"],
    ["arrow", ArrowUpRight, "Arrow"],
    ["pen", PenLine, "Pen"],
    ["text", Type, "Text"],
    ["blur", Layers, "Blur"],
  ];

  const swatches = ["#0ea5e9", "#ef4444", "#22c55e", "#f59e0b", "#ffffff", "#111827"];
  const canApply = Boolean(entry && annotations.length > 0);

  const canvasRatio = entry ? `${entry.width} / ${entry.height}` : "16 / 9";

  const apply = () => {
    setDrawingId(null);
    onApply();
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Tools</CardTitle>
          <CardDescription>Draw directly on the selected screenshot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            {tools.map(([tool, ToolIcon, label]) => (
              <Button key={tool} type="button" size="sm" variant={activeTool === tool ? "default" : "outline"} className="justify-start" onClick={() => setActiveTool(tool)}>
                <ToolIcon className="h-4 w-4" /> {label}
              </Button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <div className="flex flex-wrap gap-2">
              {swatches.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color}`}
                  aria-pressed={draftColor === color}
                  className={`h-7 w-7 rounded-md border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draftColor === color ? "ring-2 ring-ring ring-offset-2 ring-offset-card" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setDraftColor(color)}
                />
              ))}
              <input
                aria-label="Custom color"
                className="h-7 w-10 rounded-md border bg-background p-0"
                type="color"
                value={draftColor}
                onChange={(event) => setDraftColor(event.target.value)}
              />
            </div>
          </div>

          <label className="block space-y-2 text-sm font-medium">
            Stroke width
            <input
              className="w-full accent-primary"
              type="range"
              min={1}
              max={16}
              value={strokeWidth}
              onChange={(event) => setStrokeWidth(Number(event.target.value))}
            />
            <span className="text-xs text-muted-foreground">{strokeWidth}px</span>
          </label>

          <label className="block space-y-2 text-sm font-medium">
            Text
            <input
              className="h-9 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
              value={textDraft}
              onChange={(event) => setTextDraft(event.target.value)}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            Text size
            <input
              className="w-full accent-primary"
              type="range"
              min={12}
              max={56}
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
            <span className="text-xs text-muted-foreground">{fontSize}px</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={annotations.length === 0} onClick={undo}>Undo</Button>
            <Button type="button" variant="outline" disabled={annotations.length === 0} onClick={clear}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>
          </div>

          <Button type="button" variant="outline" className="w-full justify-start" disabled={!selectedAnnotationId} onClick={deleteSelected}>
            <Trash2 className="h-4 w-4" /> Delete selected
          </Button>

          <Button className="w-full" disabled={!canApply} onClick={apply}>Apply changes</Button>
          <p className="text-xs leading-5 text-muted-foreground">
            {entry
              ? `${annotations.length} pending mark${annotations.length === 1 ? "" : "s"}${selectedAnnotation ? ` - selected ${selectedAnnotation.tool}` : ""}.`
              : "Select a screenshot from History first."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{entry ? "Editor canvas" : "No screenshot selected"}</CardTitle>
          <CardDescription>{entry ? entry.originalPath : "Capture or select a screenshot from History first."}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-4">
            {entry && imageUrl ? (
              <div
                ref={canvasRef}
                className="relative max-h-full max-w-full cursor-crosshair overflow-hidden rounded-md border bg-background shadow-sm"
                style={{ aspectRatio: canvasRatio, height: "100%" }}
                onPointerDown={startDrawing}
                onPointerMove={continueDrawing}
                onPointerUp={finishDrawing}
                onPointerCancel={() => setDrawingId(null)}
              >
                <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
                {annotations.map((annotation, index) => (
                  <AnnotationPreview key={annotation.id} entry={entry} annotation={annotation} fallbackOffset={index} selected={selectedAnnotationId === annotation.id} />
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                {entry ? (imageFailed ? "Screenshot preview could not be loaded" : `${entry.width} x ${entry.height}`) : "Empty canvas"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnnotationPreview({
  entry,
  annotation,
  fallbackOffset,
  selected,
}: {
  entry: ShotHistoryEntry | null;
  annotation: ShotAnnotation;
  fallbackOffset: number;
  selected: boolean;
}) {
  const first = annotation.points[0] || { x: 80 + fallbackOffset * 18, y: 70 + fallbackOffset * 18 };
  const second = annotation.points[1] || { x: first.x + 160, y: first.y + 90 };
  const width = entry?.width || 1280;
  const height = entry?.height || 720;
  const isLineLike = annotation.tool === "pen" || annotation.tool === "line" || annotation.tool === "arrow";
  if (isLineLike) {
    const points = annotation.tool === "pen" ? annotation.points : [first, second];
    const path = points.map((point) => `${point.x},${point.y}`).join(" ");
    return (
      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <marker id={`arrow-${annotation.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill={annotation.color} />
          </marker>
        </defs>
        {annotation.tool === "pen" ? (
          <polyline points={path} fill="none" stroke={annotation.color} strokeWidth={annotation.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <line
            x1={first.x}
            y1={first.y}
            x2={second.x}
            y2={second.y}
            stroke={annotation.color}
            strokeWidth={annotation.strokeWidth}
            strokeLinecap="round"
            markerEnd={annotation.tool === "arrow" ? `url(#arrow-${annotation.id})` : undefined}
          />
        )}
        {selected && <polyline points={path} fill="none" stroke="white" strokeWidth={Math.max(2, annotation.strokeWidth + 4)} strokeOpacity="0.65" strokeLinecap="round" strokeLinejoin="round" />}
      </svg>
    );
  }
  const left = `${(Math.min(first.x, second.x) / width) * 100}%`;
  const top = `${(Math.min(first.y, second.y) / height) * 100}%`;
  const boxWidth = `${(Math.max(24, Math.abs(second.x - first.x)) / width) * 100}%`;
  const boxHeight = `${(Math.max(18, Math.abs(second.y - first.y)) / height) * 100}%`;
  const isText = annotation.tool === "text";
  const isEllipse = annotation.tool === "ellipse";
  return (
    <div
      className={`pointer-events-none absolute border-2 bg-background/15 px-2 py-1 text-xs font-medium ${isEllipse ? "rounded-full" : "rounded"} ${selected ? "shadow-[0_0_0_2px_rgb(255_255_255_/_0.85)]" : ""}`}
      style={{
        left,
        top,
        width: isText ? undefined : boxWidth,
        height: isText ? undefined : boxHeight,
        minWidth: isText ? 80 : undefined,
        minHeight: isText ? 32 : undefined,
        borderColor: annotation.color,
        color: annotation.color,
        backgroundColor: annotation.tool === "blur" ? "rgb(100 116 139 / 0.22)" : undefined,
      }}
    >
      {annotation.text || annotation.tool}
      {selected && !isText && (
        <button
          type="button"
          data-editor-handle
          aria-label="Resize selected annotation"
          className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 rounded-full border border-background bg-primary shadow"
        />
      )}
    </div>
  );
}

function clampPoint(point: { x: number; y: number }, entry: ShotHistoryEntry | null) {
  if (!entry) return point;
  return {
    x: Math.max(0, Math.min(entry.width, Math.round(point.x))),
    y: Math.max(0, Math.min(entry.height, Math.round(point.y))),
  };
}

function findAnnotationAtPoint(annotations: ShotAnnotation[], point: { x: number; y: number }) {
  for (const annotation of [...annotations].reverse()) {
    const first = annotation.points[0];
    if (!first) continue;
    if (annotation.tool === "pen" || annotation.tool === "arrow" || annotation.tool === "line") {
      const points = annotation.tool === "pen" ? annotation.points : [annotation.points[0], annotation.points[1]].filter(Boolean);
      for (const candidate of points) {
        if (Math.abs(candidate.x - point.x) <= 18 && Math.abs(candidate.y - point.y) <= 18) return annotation;
      }
      continue;
    }
    const second = annotation.points[1] || { x: first.x + 120, y: first.y + 60 };
    const left = Math.min(first.x, second.x) - 10;
    const right = Math.max(first.x, second.x) + 10;
    const top = Math.min(first.y, second.y) - 10;
    const bottom = Math.max(first.y, second.y) + 10;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return annotation;
  }
  return null;
}

function ActionRow({ icon: Icon, title, description, value }: { icon: typeof Image; title: string; description: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/25 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{title}</p>
          <span className="shrink-0 text-xs text-muted-foreground">{value}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function IconAction({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof Edit3;
  label: string;
  disabled?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button type="button" size="icon" variant="ghost" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function AccountAvatar({ session, size = "sm" }: { session: ShotSession; size?: "sm" | "lg" }) {
  const avatarUrl = resolveAvatarUrl(session.user?.avatarUrl);
  const initials = (session.user?.name || session.user?.username || "AS")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dimensions = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${dimensions} shrink-0 rounded-full border object-cover shadow-sm`} />;
  }
  return (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-full border bg-primary/10 text-xs font-bold text-primary shadow-sm`}>
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function resolveAvatarUrl(avatarUrl?: string | null) {
  if (!avatarUrl) return "";
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${atrisHubUrl}${avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`}`;
}

async function copyPath(path: string) {
  if (isNativeRuntime()) await nativeRuntime.copyShotPath(path);
  else await nativeRuntime.copyText(path);
}

async function reveal(path: string) {
  if (isNativeRuntime()) await nativeRuntime.revealShot(path);
}

function createPreviewEntry(request: CaptureRequest, display?: DisplayInfo): ShotHistoryEntry {
  const width = request.region?.width || display?.width || 1440;
  const height = request.region?.height || display?.height || 900;
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    mode: request.mode,
    originalPath: "Browser preview - packaged app creates real files",
    width,
    height,
    displayName: display?.name || "Preview display",
    annotationsCount: 0,
    region: request.region || {
      displayId: display?.id || "preview",
      x: display?.x || 0,
      y: display?.y || 0,
      width,
      height,
    },
  };
}
