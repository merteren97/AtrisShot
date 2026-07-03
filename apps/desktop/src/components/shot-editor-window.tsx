"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  Image,
  Layers,
  Minus,
  PenLine,
  RectangleHorizontal,
  RotateCcw,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { ShotAnnotation, ShotHistoryEntry } from "@atris-shot/shot-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { cn } from "@/lib/utils";

const TOOL_SWATCHES = ["#0ea5e9", "#ef4444", "#22c55e", "#f59e0b", "#ffffff", "#111827"];
const DEFAULT_BLUR_PIXEL_SIZE = 12;

type EditorStatus = "Loading" | "Ready" | "Applied" | "Missing" | "Empty" | "Failed";

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

export function ShotEditorWindow() {
  const [entry, setEntry] = useState<ShotHistoryEntry | null>(null);
  const [fileMissing, setFileMissing] = useState(false);
  const [annotations, setAnnotations] = useState<ShotAnnotation[]>([]);
  const [status, setStatus] = useState<EditorStatus>("Loading");
  const [loadError, setLoadError] = useState("");

  const loadEntry = useCallback(async (id?: string) => {
    setStatus("Loading");
    setLoadError("");
    try {
      const entries = await nativeRuntime.listShotHistory();
      const next = (id ? entries.find((item) => item.id === id) : entries[0]) ?? null;
      setEntry(next);
      setAnnotations([]);
      if (!next) {
        setFileMissing(false);
        setStatus("Empty");
        return;
      }
      const exists = await nativeRuntime.pathExists(next.editedPath || next.originalPath);
      setFileMissing(!exists);
      setStatus(exists ? "Ready" : "Missing");
    } catch (error) {
      setLoadError(String(error));
      setStatus("Failed");
    }
  }, []);

  useEffect(() => {
    void loadEntry();
    if (!isNativeRuntime()) return;
    let unlistenEditor: (() => void) | undefined;
    let unlistenShot: (() => void) | undefined;
    void nativeRuntime.onEditorShotRequested((shotId) => {
      void loadEntry(shotId);
    }).then((dispose) => {
      unlistenEditor = dispose;
    });
    void nativeRuntime.onShotCaptured((next) => {
      setEntry((current) => (current?.id === next.id ? next : current));
    }).then((dispose) => {
      unlistenShot = dispose;
    });
    return () => {
      unlistenEditor?.();
      unlistenShot?.();
    };
  }, [loadEntry]);

  const applyAnnotations = async (nextAnnotations: ShotAnnotation[]) => {
    if (!entry || fileMissing) return;
    const normalized = normalizeAnnotations(nextAnnotations);
    if (!normalized.length) {
      setAnnotations([]);
      return;
    }
    const next = await nativeRuntime.applyAnnotations(entry.id, JSON.stringify(normalized));
    setEntry(next);
    setAnnotations([]);
    setStatus("Applied");
    const settings = await loadDesktopSettings().catch(() => null);
    await nativeRuntime.showOverlay(settings?.overlayCorner);
    await nativeRuntime.hideEditorWindow();
  };

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ShotEditor
        entry={entry}
        status={status}
        loadError={loadError}
        fileMissing={fileMissing}
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        onApply={(nextAnnotations) => void applyAnnotations(nextAnnotations)}
        onReload={() => void loadEntry(entry?.id)}
      />
    </main>
  );
}

function ShotEditor({
  entry,
  status,
  loadError,
  fileMissing,
  annotations,
  onAnnotationsChange,
  onApply,
  onReload,
}: {
  entry: ShotHistoryEntry | null;
  status: EditorStatus;
  loadError: string;
  fileMissing: boolean;
  annotations: ShotAnnotation[];
  onAnnotationsChange: (annotations: ShotAnnotation[]) => void;
  onApply: (annotations: ShotAnnotation[]) => void;
  onReload: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeTool, setActiveTool] = useState<ShotAnnotation["tool"]>("rectangle");
  const [draftColor, setDraftColor] = useState("#0ea5e9");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<ShotAnnotation[][]>([]);
  const [editInteraction, setEditInteraction] = useState<{
    id: string;
    mode: "move" | "resize" | "resize-start";
    start: { x: number; y: number };
    originalPoints: Array<{ x: number; y: number }>;
  } | null>(null);

  const imagePath = entry ? entry.editedPath || entry.originalPath : "";
  const { dataUrl: imageUrl, failed: imageFailed } = useShotDataUrl(imagePath);
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;
  const canApply = Boolean(entry && !fileMissing && normalizeAnnotations(annotations).length > 0);
  const canvasRatio = entry ? `${entry.width} / ${entry.height}` : "16 / 9";

  useEffect(() => {
    setDrawingId(null);
    setSelectedAnnotationId(null);
    setEditingTextId(null);
    setEditInteraction(null);
    setUndoStack([]);
  }, [entry?.id]);

  useEffect(() => {
    if (!editingTextId) return;
    window.requestAnimationFrame(() => {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    });
  }, [editingTextId]);

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !entry) return null;
    const x = Math.max(0, Math.min(entry.width, ((event.clientX - rect.left) / rect.width) * entry.width));
    const y = Math.max(0, Math.min(entry.height, ((event.clientY - rect.top) / rect.height) * entry.height));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const updateAnnotation = (id: string, updater: (annotation: ShotAnnotation) => ShotAnnotation) => {
    onAnnotationsChange(annotations.map((annotation) => (annotation.id === id ? updater(annotation) : annotation)));
  };

  const rememberUndo = (snapshot = annotations) => {
    setUndoStack((current) => [...current.slice(-31), cloneAnnotations(snapshot)]);
  };

  const updateAnnotationWithUndo = (id: string, updater: (annotation: ShotAnnotation) => ShotAnnotation) => {
    rememberUndo();
    updateAnnotation(id, updater);
  };

  const removeAnnotation = (id: string, recordUndo = true) => {
    if (recordUndo) rememberUndo();
    onAnnotationsChange(annotations.filter((annotation) => annotation.id !== id));
    if (selectedAnnotationId === id) setSelectedAnnotationId(null);
    if (editingTextId === id) setEditingTextId(null);
  };

  const finishTextEdit = (id: string) => {
    const annotation = annotations.find((item) => item.id === id);
    if (annotation?.tool === "text" && !annotation.text?.trim()) {
      removeAnnotation(id, false);
      return;
    }
    setEditingTextId(null);
  };

  const startDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!entry || (event.target as HTMLElement).closest("[data-editor-inline-text]")) return;
    const point = pointFromEvent(event);
    if (!point) return;

    const handleTarget = (event.target as HTMLElement).closest("[data-editor-handle]");
    if (handleTarget && selectedAnnotation) {
      event.currentTarget.setPointerCapture(event.pointerId);
      rememberUndo();
      setEditingTextId(null);
      setEditInteraction({
        id: selectedAnnotation.id,
        mode:
          handleTarget.getAttribute("data-editor-handle") === "move"
            ? "move"
            : handleTarget.getAttribute("data-editor-handle") === "resize-start"
              ? "resize-start"
              : "resize",
        start: point,
        originalPoints: selectedAnnotation.points,
      });
      return;
    }

    const hitId = (event.target as HTMLElement).closest("[data-editor-hit]")?.getAttribute("data-editor-hit");
    const hit = (hitId ? annotations.find((annotation) => annotation.id === hitId) : null) || findAnnotationAtPoint(annotations, point);
    if (hit) {
      setSelectedAnnotationId(hit.id);
      setActiveTool(hit.tool);
      setDraftColor(hit.color);
      setStrokeWidth(hit.strokeWidth);
      if (hit.fontSize) setFontSize(hit.fontSize);
      if (hit.tool === "text") {
        if (hit.id === selectedAnnotationId || event.detail > 1) {
          setEditingTextId(hit.id);
        } else {
          setEditingTextId(null);
        }
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setEditingTextId(null);
      rememberUndo();
      setEditInteraction({ id: hit.id, mode: "move", start: point, originalPoints: hit.points });
      return;
    }

    setEditingTextId(null);
    const id = crypto.randomUUID();
    if (activeTool === "text") {
      rememberUndo();
      const annotation: ShotAnnotation = {
        id,
        tool: "text",
        color: draftColor,
        strokeWidth: 1,
        points: [point, clampPoint({ x: point.x + Math.max(140, fontSize * 6), y: point.y + fontSize + 20 }, entry)],
        text: "",
        fontSize,
      };
      onAnnotationsChange([...annotations, annotation]);
      setSelectedAnnotationId(id);
      setEditingTextId(id);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    rememberUndo();
    const annotation: ShotAnnotation = {
      id,
      tool: activeTool,
      color: activeTool === "blur" ? "#64748b" : draftColor,
      strokeWidth: activeTool === "blur" ? Math.max(DEFAULT_BLUR_PIXEL_SIZE, strokeWidth) : strokeWidth,
      points: activeTool === "pen" ? [point] : [point, point],
    };
    onAnnotationsChange([...annotations, annotation]);
    setDrawingId(id);
    setSelectedAnnotationId(id);
  };

  const continueDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!entry) return;
    if (editInteraction) {
      const point = pointFromEvent(event);
      if (!point) return;
      const dx = point.x - editInteraction.start.x;
      const dy = point.y - editInteraction.start.y;
      onAnnotationsChange(
        annotations.map((annotation) => {
          if (annotation.id !== editInteraction.id) return annotation;
          if (editInteraction.mode === "resize-start") {
            const second = editInteraction.originalPoints[1] || editInteraction.originalPoints[0] || point;
            return { ...annotation, points: [clampPoint(point, entry), second] };
          }
          if (editInteraction.mode === "resize") {
            const first = editInteraction.originalPoints[0] || point;
            const next = { ...annotation, points: [first, clampPoint(point, entry)] };
            return annotation.tool === "text" ? resizeTextAnnotation(next, null, entry) : next;
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

  const finishDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!drawingId && !editInteraction) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrawingId(null);
    if (editInteraction) {
      const changed = annotations.find((annotation) => annotation.id === editInteraction.id);
      if (changed?.tool === "text") {
        updateAnnotation(changed.id, (annotation) => resizeTextAnnotation(annotation, null, entry));
      }
    }
    setEditInteraction(null);
  };

  const setActiveToolAndSync = (tool: ShotAnnotation["tool"]) => {
    setActiveTool(tool);
    setEditingTextId(null);
    if (selectedAnnotation && selectedAnnotation.tool === tool) {
      setDraftColor(selectedAnnotation.color);
      setStrokeWidth(selectedAnnotation.strokeWidth);
      if (selectedAnnotation.fontSize) setFontSize(selectedAnnotation.fontSize);
    } else if (tool === "blur") {
      setStrokeWidth(DEFAULT_BLUR_PIXEL_SIZE);
    }
  };

  const updateColor = (color: string) => {
    setDraftColor(color);
    if (selectedAnnotationId) updateAnnotationWithUndo(selectedAnnotationId, (annotation) => ({ ...annotation, color: annotation.tool === "blur" ? annotation.color : color }));
  };

  const updateStrokeWidth = (width: number) => {
    setStrokeWidth(width);
    if (selectedAnnotationId) updateAnnotationWithUndo(selectedAnnotationId, (annotation) => ({ ...annotation, strokeWidth: annotation.tool === "text" ? annotation.strokeWidth : width }));
  };

  const updateFontSize = (size: number) => {
    setFontSize(size);
    if (selectedAnnotationId) updateAnnotationWithUndo(selectedAnnotationId, (annotation) => (annotation.tool === "text" ? resizeTextAnnotation({ ...annotation, fontSize: size }, null, entry) : annotation));
  };

  const updateTextBox = (id: string, text: string, element?: HTMLTextAreaElement | null) => {
    const annotation = annotations.find((item) => item.id === id);
    if (!entry || !annotation) {
      updateAnnotation(id, (item) => ({ ...item, text }));
      return;
    }
    updateAnnotation(id, (item) => resizeTextAnnotation({ ...item, text }, element || null, entry));
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    const nextStack = undoStack.slice(0, -1);
    setUndoStack(nextStack);
    onAnnotationsChange(cloneAnnotations(previous));
    setSelectedAnnotationId(previous.at(-1)?.id ?? null);
    setEditingTextId(null);
  };

  const clear = () => {
    rememberUndo();
    onAnnotationsChange([]);
    setSelectedAnnotationId(null);
    setEditingTextId(null);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("[data-editor-inline-text]"));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !typing) {
        event.preventDefault();
        undo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !typing && selectedAnnotationId) {
        event.preventDefault();
        removeAnnotation(selectedAnnotationId);
        return;
      }
      if (event.key === "Enter" && !typing && canApply) {
        event.preventDefault();
        onApply(annotations);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [annotations, canApply, onApply, selectedAnnotationId, undoStack]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="grid min-h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b bg-card/95 px-4 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry ? "Screenshot editor" : "AtrisShot Editor"}</p>
          <p className="truncate text-xs text-muted-foreground">{entry ? imagePath : loadError || "Open a screenshot from History or Overlay."}</p>
        </div>

        <ToolRail activeTool={activeTool} onSelect={setActiveToolAndSync} />

        <div className="flex justify-end gap-2">
          <Button type="button" size="icon" variant="ghost" aria-label="Reload screenshot" title="Reload screenshot" onClick={onReload}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!undoStack.length} onClick={undo}>
            <ArrowUpRight className="h-4 w-4 rotate-180" />
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Clear annotations" title="Clear annotations" disabled={!annotations.length} onClick={clear}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button type="button" disabled={!canApply} onClick={() => onApply(annotations)}>
            <Check className="h-4 w-4" /> Apply
          </Button>
        </div>
      </header>

      <ContextToolbar
        activeTool={activeTool}
        selectedAnnotation={selectedAnnotation}
        draftColor={draftColor}
        strokeWidth={strokeWidth}
        fontSize={fontSize}
        editingText={Boolean(editingTextId)}
        onColorChange={updateColor}
        onStrokeWidthChange={updateStrokeWidth}
        onFontSizeChange={updateFontSize}
        onDeleteSelected={() => selectedAnnotationId && removeAnnotation(selectedAnnotationId)}
      />

      <section className="min-h-0 flex-1 overflow-hidden p-4">
        <div className="relative flex h-full items-center justify-center overflow-hidden rounded-lg border bg-card/40 p-4">
          {entry && fileMissing ? (
            <EditorState icon={Image} title="Local file missing" description="This history record exists, but the screenshot file is no longer available on this device." />
          ) : entry && imageUrl ? (
            <div
              ref={canvasRef}
              data-editor-canvas
              className="relative max-h-full max-w-full cursor-crosshair overflow-hidden rounded-md border bg-background shadow-xl"
              style={{ aspectRatio: canvasRatio, height: "100%" }}
              onPointerDown={startDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={finishDrawing}
              onPointerCancel={() => {
                setDrawingId(null);
                setEditInteraction(null);
              }}
            >
              <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
              {annotations.map((annotation, index) => (
                <AnnotationPreview
                  key={annotation.id}
                  entry={entry}
                  annotation={annotation}
                  fallbackOffset={index}
                  selected={selectedAnnotationId === annotation.id}
                  editing={editingTextId === annotation.id}
                  textInputRef={editingTextId === annotation.id ? textInputRef : undefined}
                  onTextChange={(value, element) => updateTextBox(annotation.id, value, element)}
                  onTextCommit={() => finishTextEdit(annotation.id)}
                  onTextCancel={() => removeAnnotation(annotation.id)}
                />
              ))}
            </div>
          ) : (
            <EditorState
              icon={Image}
              title={status === "Empty" ? "No screenshot selected" : imageFailed ? "Preview unavailable" : "Loading screenshot"}
              description={
                status === "Empty"
                  ? "Use History or the result overlay to open a screenshot in this editor."
                  : imageFailed
                    ? "The local file exists, but its preview could not be loaded."
                    : entry
                      ? `${entry.width} x ${entry.height}`
                      : loadError || "Preparing the editor window."
              }
            />
          )}

          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
            <Badge>{status}</Badge>
            {selectedAnnotation && <Badge>{selectedAnnotation.tool}</Badge>}
            {annotations.length > 0 && <Badge>{normalizeAnnotations(annotations).length} pending</Badge>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolRail({ activeTool, onSelect }: { activeTool: ShotAnnotation["tool"]; onSelect: (tool: ShotAnnotation["tool"]) => void }) {
  const tools: Array<{ tool: ShotAnnotation["tool"]; icon: LucideIcon; label: string }> = [
    { tool: "rectangle", icon: RectangleHorizontal, label: "Rectangle" },
    { tool: "ellipse", icon: Circle, label: "Ellipse" },
    { tool: "line", icon: Minus, label: "Line" },
    { tool: "arrow", icon: ArrowUpRight, label: "Arrow" },
    { tool: "pen", icon: PenLine, label: "Pen" },
    { tool: "text", icon: Type, label: "Text" },
    { tool: "blur", icon: Layers, label: "Blur" },
  ];

  return (
    <div className="flex items-center rounded-full border bg-background/80 p-1 shadow-sm" aria-label="Editor tools">
      {tools.map(({ tool, icon: ToolIcon, label }) => (
        <button
          key={tool}
          type="button"
          aria-label={label}
          aria-pressed={activeTool === tool}
          title={label}
          onClick={() => onSelect(tool)}
          className={cn(
            "group flex h-9 min-w-9 items-center justify-center overflow-hidden rounded-full px-2 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            activeTool === tool ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <ToolIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="max-w-0 translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-24 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-24 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

function ContextToolbar({
  activeTool,
  selectedAnnotation,
  draftColor,
  strokeWidth,
  fontSize,
  editingText,
  onColorChange,
  onStrokeWidthChange,
  onFontSizeChange,
  onDeleteSelected,
}: {
  activeTool: ShotAnnotation["tool"];
  selectedAnnotation: ShotAnnotation | null;
  draftColor: string;
  strokeWidth: number;
  fontSize: number;
  editingText: boolean;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
  onDeleteSelected: () => void;
}) {
  const isText = activeTool === "text";
  const isBlur = activeTool === "blur";
  return (
    <div className="flex shrink-0 justify-center border-b bg-background/92 px-4 py-3 backdrop-blur">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-full border bg-card px-3 py-2 shadow-sm">
        {!isBlur && (
          <div className="flex items-center gap-2">
            {TOOL_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                aria-pressed={draftColor === color}
                className={cn("h-6 w-6 rounded-full border shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", draftColor === color && "ring-2 ring-ring ring-offset-2 ring-offset-card")}
                style={{ backgroundColor: color }}
                onClick={() => onColorChange(color)}
              />
            ))}
            <input
              aria-label="Custom color"
              className="h-7 w-9 cursor-pointer rounded-full border bg-background p-0"
              type="color"
              value={draftColor}
              onChange={(event) => onColorChange(event.target.value)}
            />
          </div>
        )}

        {!isText && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isBlur ? "Pixel size" : "Stroke"}
            <input
              className="w-32 accent-primary"
              type="range"
              min={isBlur ? 4 : 1}
              max={isBlur ? 48 : 24}
              value={strokeWidth}
              onChange={(event) => onStrokeWidthChange(Number(event.target.value))}
            />
            <span className="w-8 text-foreground">{strokeWidth}px</span>
          </label>
        )}

        {isText && (
          <>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Text size
              <input className="w-32 accent-primary" type="range" min={12} max={64} value={fontSize} onChange={(event) => onFontSizeChange(Number(event.target.value))} />
              <span className="w-9 text-foreground">{fontSize}px</span>
            </label>
            <Badge>{editingText ? "Typing" : "Click canvas to write"}</Badge>
          </>
        )}

        {selectedAnnotation && (
          <Button type="button" size="sm" variant="ghost" onClick={onDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" /> Delete selected
          </Button>
        )}
      </div>
    </div>
  );
}

function AnnotationPreview({
  entry,
  annotation,
  fallbackOffset,
  selected,
  editing,
  textInputRef,
  onTextChange,
  onTextCommit,
  onTextCancel,
}: {
  entry: ShotHistoryEntry | null;
  annotation: ShotAnnotation;
  fallbackOffset: number;
  selected: boolean;
  editing: boolean;
  textInputRef?: RefObject<HTMLTextAreaElement | null>;
  onTextChange: (value: string, element: HTMLTextAreaElement) => void;
  onTextCommit: () => void;
  onTextCancel: () => void;
}) {
  const first = annotation.points[0] || { x: 80 + fallbackOffset * 18, y: 70 + fallbackOffset * 18 };
  const second = annotation.points[1] || { x: first.x + 160, y: first.y + 90 };
  const width = entry?.width || 1280;
  const height = entry?.height || 720;
  const isLineLike = annotation.tool === "pen" || annotation.tool === "line" || annotation.tool === "arrow";
  if (isLineLike) {
    const points = annotation.tool === "pen" ? annotation.points : [first, second];
    const path = points.map((point) => `${point.x},${point.y}`).join(" ");
    const hitStroke = Math.max(18, annotation.strokeWidth + 14);
    return (
      <>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <marker id={`arrow-${annotation.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L9,3 z" fill={annotation.color} />
            </marker>
          </defs>
          {annotation.tool === "pen" ? (
            <polyline
              data-editor-hit={annotation.id}
              className="pointer-events-auto cursor-move"
              points={path}
              fill="none"
              stroke="rgba(0,0,0,0.001)"
              strokeWidth={hitStroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <line
              data-editor-hit={annotation.id}
              className="pointer-events-auto cursor-move"
              x1={first.x}
              y1={first.y}
              x2={second.x}
              y2={second.y}
              stroke="rgba(0,0,0,0.001)"
              strokeWidth={hitStroke}
              strokeLinecap="round"
            />
          )}
          {selected && <polyline points={path} fill="none" stroke="white" strokeWidth={Math.max(2, annotation.strokeWidth + 4)} strokeOpacity="0.65" strokeLinecap="round" strokeLinejoin="round" />}
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
        </svg>
        {selected &&
          points.slice(0, annotation.tool === "pen" ? points.length : 2).map((point, index) =>
            annotation.tool === "pen" ? (
              <span
                key={`${annotation.id}-${index}`}
                className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background shadow"
                style={{ left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%`, borderColor: annotation.color }}
              />
            ) : (
              <button
                key={`${annotation.id}-${index}`}
                type="button"
                data-editor-handle={index === 0 ? "resize-start" : "resize"}
                aria-label={index === 0 ? "Move start point" : "Move end point"}
                className="pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow"
                style={{ left: `${(point.x / width) * 100}%`, top: `${(point.y / height) * 100}%` }}
              />
            ),
          )}
      </>
    );
  }

  const left = `${(Math.min(first.x, second.x) / width) * 100}%`;
  const top = `${(Math.min(first.y, second.y) / height) * 100}%`;
  const boxWidth = `${(Math.max(24, Math.abs(second.x - first.x)) / width) * 100}%`;
  const boxHeight = `${(Math.max(18, Math.abs(second.y - first.y)) / height) * 100}%`;
  const isText = annotation.tool === "text";
  const isEllipse = annotation.tool === "ellipse";
  const isBlur = annotation.tool === "blur";
  const pixelSize = Math.max(4, Math.min(48, annotation.strokeWidth));

  if (isText && editing) {
    return (
      <textarea
        ref={textInputRef}
        data-editor-inline-text
        aria-label="Annotation text"
        value={annotation.text || ""}
        placeholder="Type..."
        onChange={(event) => onTextChange(event.target.value, event.currentTarget)}
        onBlur={onTextCommit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onTextCancel();
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onTextCommit();
          }
        }}
        className="absolute z-20 min-h-10 min-w-24 resize-none overflow-hidden rounded-md border bg-background/95 px-2 py-1 font-medium leading-tight outline-none ring-2 ring-ring shadow-xl"
        style={{
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          color: annotation.color,
          borderColor: annotation.color,
          fontSize: `${Math.max(12, Math.min(40, annotation.fontSize || 24))}px`,
        }}
      />
    );
  }

  return (
    <>
      <div
        data-editor-hit={annotation.id}
        className={cn("pointer-events-auto absolute cursor-move", isEllipse ? "rounded-full" : "rounded")}
        style={{ left, top, width: boxWidth, height: boxHeight }}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute bg-background/10 px-2 py-1 font-medium",
          isEllipse ? "rounded-full" : "rounded",
          isText && "whitespace-pre-wrap break-words leading-tight",
          selected && "shadow-[0_0_0_2px_rgb(255_255_255_/_0.85)]",
        )}
        style={{
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          overflow: isText ? "visible" : undefined,
          minWidth: isText ? 80 : undefined,
          minHeight: isText ? 32 : undefined,
          borderColor: annotation.color,
          borderStyle: "solid",
          borderWidth: isText ? (selected ? 1 : 0) : Math.max(1, annotation.strokeWidth),
          color: annotation.color,
          backgroundColor: isBlur ? "rgb(100 116 139 / 0.18)" : undefined,
          backgroundImage: isBlur
            ? `linear-gradient(45deg, rgb(255 255 255 / 0.16) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.16) 75%), linear-gradient(45deg, rgb(0 0 0 / 0.16) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.16) 75%)`
            : undefined,
          backgroundPosition: isBlur ? `0 0, ${pixelSize / 2}px ${pixelSize / 2}px` : undefined,
          backgroundSize: isBlur ? `${pixelSize}px ${pixelSize}px` : undefined,
          backdropFilter: isBlur ? `blur(${Math.min(10, pixelSize / 4)}px)` : undefined,
          fontSize: isText ? `${Math.max(12, Math.min(40, annotation.fontSize || 24))}px` : undefined,
        }}
      >
        {isText ? annotation.text || "Text" : null}
        {selected && (
          <>
            <button
              type="button"
              data-editor-handle="move"
              aria-label="Move selected annotation"
              title="Move"
              className="pointer-events-auto absolute -left-2 -top-2 h-4 w-4 cursor-move rounded-full border border-background bg-primary shadow"
            />
            <button
              type="button"
              data-editor-handle="resize"
              aria-label="Resize selected annotation"
              title="Resize"
              className="pointer-events-auto absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-background bg-primary shadow"
            />
          </>
        )}
      </div>
    </>
  );
}

function EditorState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <Card className="max-w-md">
      <CardContent className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
        <Icon className="h-10 w-10 text-muted-foreground" />
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function normalizeAnnotations(annotations: ShotAnnotation[]) {
  return annotations.filter((annotation) => annotation.tool !== "text" || Boolean(annotation.text?.trim()));
}

function cloneAnnotations(annotations: ShotAnnotation[]) {
  return annotations.map((annotation) => ({
    ...annotation,
    points: annotation.points.map((point) => ({ ...point })),
  }));
}

function clampPoint(point: { x: number; y: number }, entry: ShotHistoryEntry | null) {
  if (!entry) return point;
  return {
    x: Math.max(0, Math.min(entry.width, Math.round(point.x))),
    y: Math.max(0, Math.min(entry.height, Math.round(point.y))),
  };
}

function resizeTextAnnotation(annotation: ShotAnnotation, element: HTMLTextAreaElement | null, entry: ShotHistoryEntry | null) {
  if (annotation.tool !== "text" || !entry) return annotation;
  const first = annotation.points[0];
  const second = annotation.points[1] || { x: first.x + 180, y: first.y + 48 };
  const width = Math.max(80, Math.abs(second.x - first.x));
  const fontSize = Math.max(12, Math.min(64, annotation.fontSize || 24));
  let height = estimateTextHeight(annotation.text || "", width, fontSize);

  if (element) {
    const canvas = element.closest("[data-editor-canvas]") as HTMLElement | null;
    const canvasRect = canvas?.getBoundingClientRect();
    if (canvasRect) {
      element.style.height = "auto";
      const measured = Math.max(40, element.scrollHeight);
      height = Math.max(height, Math.round((measured / canvasRect.height) * entry.height));
    }
  }

  return {
    ...annotation,
    points: [first, clampPoint({ x: first.x + width, y: first.y + height }, entry)],
  };
}

function estimateTextHeight(text: string, width: number, fontSize: number) {
  const usableWidth = Math.max(fontSize * 2.5, width - fontSize * 0.9);
  const charsPerLine = Math.max(1, Math.floor(usableWidth / (fontSize * 0.48)));
  const lines = (text || "Text").split("\n").reduce((total, line) => {
    if (!line) return total + 1;
    const words = line.split(/(\s+)/);
    let wrappedLines = 1;
    let currentLineLength = 0;
    for (const word of words) {
      const wordLength = word.length;
      if (currentLineLength > 0 && currentLineLength + wordLength > charsPerLine) {
        wrappedLines += 1;
        currentLineLength = Math.min(wordLength, charsPerLine);
      } else {
        currentLineLength += wordLength;
      }
      if (wordLength > charsPerLine) {
        wrappedLines += Math.floor(wordLength / charsPerLine);
        currentLineLength = wordLength % charsPerLine;
      }
    }
    return total + Math.max(1, wrappedLines);
  }, 0);
  return Math.max(32, Math.ceil(lines * fontSize * 1.35 + fontSize * 0.8 + 12));
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
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
      for (let index = 0; index < points.length - 1; index += 1) {
        if (distanceToSegment(point, points[index], points[index + 1]) <= Math.max(18, annotation.strokeWidth + 14)) return annotation;
      }
      continue;
    }
    const second = annotation.points[1] || { x: first.x + 120, y: first.y + 60 };
    const tolerance = Math.max(14, annotation.strokeWidth + 10);
    const left = Math.min(first.x, second.x) - tolerance;
    const right = Math.max(first.x, second.x) + tolerance;
    const top = Math.min(first.y, second.y) - tolerance;
    const bottom = Math.max(first.y, second.y) + tolerance;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return annotation;
  }
  return null;
}
