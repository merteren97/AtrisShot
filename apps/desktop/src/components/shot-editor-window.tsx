"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject, type WheelEvent as ReactWheelEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  Edit3,
  Image,
  Layers,
  MousePointer2,
  Minus,
  PenLine,
  RectangleHorizontal,
  RotateCcw,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize2,
  type LucideIcon,
} from "lucide-react";
import type { ShotAnnotation, ShotHistoryEntry } from "@atris-shot/shot-core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { isNativeRuntime, nativeRuntime, type EditorOpenMode } from "@/lib/native-runtime";
import { getShotImageDataUrl } from "@/lib/shot-image-cache";
import { useUiPreferences, type Locale } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

const TOOL_SWATCHES = ["#0ea5e9", "#ef4444", "#22c55e", "#f59e0b", "#ffffff", "#111827"];
const DEFAULT_BLUR_PIXEL_SIZE = 12;
const MIN_DRAW_DISTANCE = 4;
const MIN_TEXT_WIDTH = 80;
const MIN_TEXT_HEIGHT = 32;
const MIN_TEXT_FONT_SIZE = 12;
const MAX_TEXT_FONT_SIZE = 64;
const MIN_MANUAL_ZOOM = 0.1;
const MAX_MANUAL_ZOOM = 4;

type EditorStatus = "Loading" | "Ready" | "Applied" | "Missing" | "Empty" | "Failed";
type EditorTool = "select" | ShotAnnotation["tool"];
type EditInteraction = {
  id: string;
  mode: "move" | "resize" | "resize-start";
  start: { x: number; y: number };
  originalPoints: Array<{ x: number; y: number }>;
};
type PendingDraw = { start: { x: number; y: number } };
type PanInteraction = { x: number; y: number; scrollLeft: number; scrollTop: number };
type ZoomAnchor = { clientX: number; clientY: number };
type ZoomAnchorSnapshot = ZoomAnchor & { ratioX: number; ratioY: number };

const editorCopy = {
  en: {
    title: "Screenshot editor",
    emptyTitle: "AtrisShot Editor",
    emptySubtitle: "Open a screenshot from History or Overlay.",
    reload: "Reload screenshot",
    undo: "Undo",
    clear: "Clear annotations",
    apply: "Apply",
    edit: "Edit screenshot",
    previewMode: "Preview",
    localFileMissing: "Local file missing",
    localFileMissingDescription: "This history record exists, but the screenshot file is no longer available on this device.",
    noScreenshot: "No screenshot selected",
    previewUnavailable: "Preview unavailable",
    loading: "Loading screenshot",
    emptyDescription: "Use History or the result overlay to open a screenshot in this editor.",
    previewUnavailableDescription: "The local file exists, but its preview could not be loaded.",
    preparing: "Preparing the editor window.",
    pending: "pending",
    pixelSize: "Pixel size",
    fit: "Fit",
    zoomReset: "100%",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    stroke: "Stroke",
    textSize: "Text size",
    typing: "Typing",
    clickToWrite: "Click canvas to write",
    deleteSelected: "Delete selected",
    customColor: "Custom color",
    selectHint: "Select an annotation or choose a tool",
    tools: {
      select: "Select",
      rectangle: "Rectangle",
      ellipse: "Ellipse",
      line: "Line",
      arrow: "Arrow",
      pen: "Pen",
      text: "Text",
      blur: "Blur",
    },
  },
  tr: {
    title: "Ekran görüntüsü editörü",
    emptyTitle: "AtrisShot Editör",
    emptySubtitle: "Geçmişten veya sonuç overlay'inden bir ekran görüntüsü aç.",
    reload: "Ekran görüntüsünü yenile",
    undo: "Geri al",
    clear: "İşaretlemeleri temizle",
    apply: "Onayla",
    edit: "Düzenlemeye geç",
    previewMode: "Önizleme",
    localFileMissing: "Yerel dosya eksik",
    localFileMissingDescription: "Bu geçmiş kaydı duruyor, fakat ekran görüntüsü dosyası artık bu cihazda yok.",
    noScreenshot: "Ekran görüntüsü seçilmedi",
    previewUnavailable: "Önizleme kullanılamıyor",
    loading: "Ekran görüntüsü yükleniyor",
    emptyDescription: "Bu editörde açmak için Geçmişten veya sonuç overlay'inden bir ekran görüntüsü seç.",
    previewUnavailableDescription: "Yerel dosya var, fakat önizlemesi yüklenemedi.",
    preparing: "Editör penceresi hazırlanıyor.",
    pending: "bekliyor",
    pixelSize: "Piksel boyutu",
    fit: "Sığdır",
    zoomReset: "%100",
    zoomOut: "Uzaklaştır",
    zoomIn: "Yakınlaştır",
    stroke: "Çizgi",
    textSize: "Yazı boyutu",
    typing: "Yazılıyor",
    clickToWrite: "Yazmak için canvas'a tıkla",
    deleteSelected: "Seçileni sil",
    customColor: "Özel renk",
    selectHint: "Bir annotation seçin veya bir araç seçin",
    tools: {
      select: "Seçim",
      rectangle: "Dikdörtgen",
      ellipse: "Elips",
      line: "Çizgi",
      arrow: "Ok",
      pen: "Kalem",
      text: "Metin",
      blur: "Bulanıklaştır",
    },
  },
} as const;

type EditorText = Omit<Record<keyof typeof editorCopy.en, string>, "tools"> & {
  tools: Record<EditorTool, string>;
};

function useShotDataUrl(path?: string | null, revision?: number) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    if (!path || !isNativeRuntime()) return;
    void getShotImageDataUrl(path, revision, "high")
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path, revision]);

  return { dataUrl, failed };
}

export function ShotEditorWindow() {
  const [entry, setEntry] = useState<ShotHistoryEntry | null>(null);
  const [editorMode, setEditorMode] = useState<EditorOpenMode>("edit");
  const [fileMissing, setFileMissing] = useState(false);
  const [annotations, setAnnotations] = useState<ShotAnnotation[]>([]);
  const [status, setStatus] = useState<EditorStatus>("Loading");
  const [loadError, setLoadError] = useState("");
  const [entryLoadToken, setEntryLoadToken] = useState(0);

  const loadEntry = useCallback(async (id?: string, requestedMode?: EditorOpenMode) => {
    const mode = requestedMode ?? "edit";
    if (requestedMode) {
      setEditorMode(requestedMode);
    }
    setStatus("Loading");
    setLoadError("");
    try {
      const entries = await nativeRuntime.listShotHistory();
      const next = (id ? entries.find((item) => item.id === id) : entries[0]) ?? null;
      setEntry(next);
      setAnnotations(next?.annotations ?? []);
      setEntryLoadToken((current) => current + 1);
      if (!next) {
        setFileMissing(false);
        setStatus("Empty");
        return;
      }
      const pathForMode = mode === "preview" ? next.editedPath || next.originalPath : next.originalPath;
      const exists = await nativeRuntime.pathExists(pathForMode);
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
    void nativeRuntime.onEditorShotRequested((request) => {
      void loadEntry(request.id, request.mode);
    }).then((dispose) => {
      unlistenEditor = dispose;
    });
    void nativeRuntime.onShotCaptured(({ entry: next }) => {
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
    const next = await nativeRuntime.applyAnnotations(entry.id, JSON.stringify(normalized));
    setEntry(next);
    setAnnotations(next.annotations ?? normalized);
    setStatus("Applied");
    const settings = await loadDesktopSettings().catch(() => null);
    await nativeRuntime.showOverlay(settings?.overlayCorner);
    await nativeRuntime.hideEditorWindow();
  };

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <ShotEditor
        entry={entry}
        entryLoadToken={entryLoadToken}
        status={status}
        loadError={loadError}
        fileMissing={fileMissing}
        annotations={annotations}
        onAnnotationsChange={setAnnotations}
        onApply={applyAnnotations}
        mode={editorMode}
        onModeChange={(mode) => setEditorMode(mode)}
        onReload={() => void loadEntry(entry?.id, editorMode)}
      />
    </main>
  );
}

function ShotEditor({
  entry,
  entryLoadToken,
  status,
  loadError,
  fileMissing,
  annotations,
  onAnnotationsChange,
  onApply,
  mode,
  onModeChange,
  onReload,
}: {
  entry: ShotHistoryEntry | null;
  entryLoadToken: number;
  status: EditorStatus;
  loadError: string;
  fileMissing: boolean;
  annotations: ShotAnnotation[];
  onAnnotationsChange: (annotations: ShotAnnotation[]) => void;
  onApply: (annotations: ShotAnnotation[]) => Promise<void>;
  mode: EditorOpenMode;
  onModeChange: (mode: EditorOpenMode) => void;
  onReload: () => void;
}) {
  const { locale } = useUiPreferences();
  const text = editorCopy[locale];
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const annotationsRef = useRef(annotations);
  const selectedAnnotationIdRef = useRef<string | null>(null);
  const drawingIdRef = useRef<string | null>(null);
  const pendingDrawRef = useRef<PendingDraw | null>(null);
  const editInteractionRef = useRef<EditInteraction | null>(null);
  const panInteractionRef = useRef<PanInteraction | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const zoomAnchorFrameRef = useRef<number | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchInteractionRef = useRef<{
    distance: number;
    zoom: number;
  } | null>(null);
  const copiedAnnotationRef = useRef<ShotAnnotation | null>(null);
  const pasteSequenceRef = useRef(0);
  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [draftColor, setDraftColor] = useState("#0ea5e9");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [annotationsDirty, setAnnotationsDirty] = useState(false);
  const [undoStack, setUndoStack] = useState<ShotAnnotation[][]>([]);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [manualZoom, setManualZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const imagePath = entry
    ? mode === "preview"
      ? entry.editedPath || entry.originalPath
      : entry.originalPath
    : "";
  const imagePathDisplay = formatPathForDisplay(imagePath);
  const { dataUrl: imageUrl, failed: imageFailed } = useShotDataUrl(imagePath, entry?.editRevision);
  const selectedAnnotation = annotations.find((annotation) => annotation.id === selectedAnnotationId) || null;
  const canApply = Boolean(mode === "edit" && entry && !fileMissing && annotationsDirty);
  const fitZoom = entry && viewportSize.width > 0 && viewportSize.height > 0
    ? Math.min(1, (viewportSize.width - 32) / entry.width, (viewportSize.height - 32) / entry.height)
    : 1;
  const zoomScale = zoomMode === "fit" ? Math.max(0.05, fitZoom) : manualZoom;

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const setSelectedAnnotationIdSync = (id: string | null) => {
    selectedAnnotationIdRef.current = id;
    setSelectedAnnotationId(id);
  };
  const setDrawingIdSync = (id: string | null) => {
    drawingIdRef.current = id;
  };
  const setPendingDrawSync = (value: PendingDraw | null) => {
    pendingDrawRef.current = value;
  };
  const setEditInteractionSync = (value: EditInteraction | null) => {
    editInteractionRef.current = value;
  };
  const setPanInteractionSync = (value: PanInteraction | null) => {
    panInteractionRef.current = value;
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [entry?.id]);

  useEffect(() => {
    if (zoomAnchorFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomAnchorFrameRef.current);
      zoomAnchorFrameRef.current = null;
    }
    setDrawingIdSync(null);
    setPendingDrawSync(null);
    setSelectedAnnotationIdSync(null);
    setEditingTextId(null);
    setEditInteractionSync(null);
    setUndoStack([]);
    setAnnotationsDirty(false);
    setZoomMode("fit");
    setManualZoom(1);
    setPanInteractionSync(null);
    touchPointsRef.current.clear();
    pinchInteractionRef.current = null;
    copiedAnnotationRef.current = null;
    pasteSequenceRef.current = 0;
  }, [entry?.id, entryLoadToken]);

  useEffect(() => {
    if (!editingTextId) return;
    window.requestAnimationFrame(() => {
      textInputRef.current?.focus();
      textInputRef.current?.select();
    });
  }, [editingTextId]);

  const getCanvasDisplayRect = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left + canvas.clientLeft,
      top: rect.top + canvas.clientTop,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
    };
  };

  const pointFromEvent = (event: PointerEvent<HTMLDivElement>) => {
    const rect = getCanvasDisplayRect();
    if (!rect || !entry || rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.max(0, Math.min(entry.width, ((event.clientX - rect.left) / rect.width) * entry.width));
    const y = Math.max(0, Math.min(entry.height, ((event.clientY - rect.top) / rect.height) * entry.height));
    return { x: Math.round(x), y: Math.round(y) };
  };

  const touchGesture = () => {
    const points = [...touchPointsRef.current.values()];
    if (points.length < 2) return null;
    const first = points[0];
    const second = points[1];
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (distance < 1) return null;
    return {
      distance,
      center: {
        clientX: (first.x + second.x) / 2,
        clientY: (first.y + second.y) / 2,
      },
    };
  };

  const canPanViewport = () => {
    const viewport = viewportRef.current;
    return Boolean(
      viewport &&
        (viewport.scrollWidth > viewport.clientWidth + 1 || viewport.scrollHeight > viewport.clientHeight + 1),
    );
  };

  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (!canPanViewport()) return false;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanInteractionSync({
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewportRef.current?.scrollLeft || 0,
      scrollTop: viewportRef.current?.scrollTop || 0,
    });
    return true;
  };

  const updateAnnotation = (id: string, updater: (annotation: ShotAnnotation) => ShotAnnotation) => {
    setAnnotationsDirty(true);
    const next = annotationsRef.current.map((annotation) => (annotation.id === id ? updater(annotation) : annotation));
    annotationsRef.current = next;
    onAnnotationsChange(next);
  };

  const changeAnnotations = (next: ShotAnnotation[]) => {
    setAnnotationsDirty(true);
    annotationsRef.current = next;
    onAnnotationsChange(next);
  };

  const rememberUndo = (snapshot = annotationsRef.current) => {
    setUndoStack((current) => [...current.slice(-31), cloneAnnotations(snapshot)]);
  };

  const updateAnnotationWithUndo = (id: string, updater: (annotation: ShotAnnotation) => ShotAnnotation) => {
    rememberUndo();
    updateAnnotation(id, updater);
  };

  const removeAnnotation = (id: string, recordUndo = true) => {
    if (recordUndo) rememberUndo();
    changeAnnotations(annotationsRef.current.filter((annotation) => annotation.id !== id));
    if (selectedAnnotationIdRef.current === id) setSelectedAnnotationIdSync(null);
    if (editingTextId === id) setEditingTextId(null);
  };

  const copySelectedAnnotation = () => {
    const selectedId = selectedAnnotationIdRef.current;
    const selected = annotationsRef.current.find((annotation) => annotation.id === selectedId);
    if (!selected) return false;
    copiedAnnotationRef.current = cloneAnnotations([selected])[0];
    pasteSequenceRef.current = 0;
    return true;
  };

  const pasteCopiedAnnotation = () => {
    const copied = copiedAnnotationRef.current;
    if (!copied || !entry) return false;
    pasteSequenceRef.current += 1;
    const offset = Math.min(8, pasteSequenceRef.current) * 16;
    const clone = { ...cloneAnnotations([copied])[0], id: crypto.randomUUID() };
    const forward = translateAnnotation(clone, clone.points, offset, offset, entry);
    const movedForward = forward.points.some((point, index) =>
      point.x !== clone.points[index]?.x || point.y !== clone.points[index]?.y,
    );
    const next = movedForward
      ? forward
      : translateAnnotation(clone, clone.points, -offset, -offset, entry);
    rememberUndo();
    changeAnnotations([...annotationsRef.current, next]);
    setActiveTool("select");
    setEditingTextId(null);
    setSelectedAnnotationIdSync(next.id);
    return true;
  };

  const startDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!entry || (event.target as HTMLElement).closest("[data-editor-inline-text]")) return;
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const gesture = touchGesture();
      if (gesture) {
        event.preventDefault();
        setDrawingIdSync(null);
        setPendingDrawSync(null);
        setEditInteractionSync(null);
        setPanInteractionSync(null);
        pinchInteractionRef.current = { distance: gesture.distance, zoom: zoomScale };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (mode === "preview") {
      if (event.button === 0 || event.button === 1 || spacePressed) beginPan(event);
      return;
    }
    if (event.button === 1 || spacePressed) {
      beginPan(event);
      return;
    }
    const point = pointFromEvent(event);
    if (!point) return;

    const selectedId = selectedAnnotationIdRef.current;
    const handleTarget = (event.target as HTMLElement).closest("[data-editor-handle]");
    const handleOwnerId = handleTarget?.getAttribute("data-editor-id");
    const selectedForHandle = selectedId ? annotationsRef.current.find((annotation) => annotation.id === selectedId) : null;
    if (handleTarget && selectedForHandle && handleOwnerId === selectedForHandle.id) {
      event.currentTarget.setPointerCapture(event.pointerId);
      rememberUndo();
      setEditingTextId(null);
      setEditInteractionSync({
        id: selectedForHandle.id,
        mode:
          handleTarget.getAttribute("data-editor-handle") === "move"
            ? "move"
            : handleTarget.getAttribute("data-editor-handle") === "resize-start"
              ? "resize-start"
              : "resize",
        start: point,
        originalPoints: selectedForHandle.points,
      });
      return;
    }

    const hitId = (event.target as HTMLElement).closest("[data-editor-hit]")?.getAttribute("data-editor-hit");
    const hit = (hitId ? annotationsRef.current.find((annotation) => annotation.id === hitId) : null) || findAnnotationAtPoint(annotationsRef.current, point, zoomScale);
    if (hit) {
      setSelectedAnnotationIdSync(hit.id);
      setDraftColor(hit.color);
      setStrokeWidth(hit.tool === "blur" ? hit.blurPixelSize ?? hit.strokeWidth : hit.strokeWidth);
      if (hit.fontSize) setFontSize(hit.fontSize);
      if (event.detail > 1) {
        setEditingTextId(hit.tool === "text" ? hit.id : null);
        return;
      }
      if (hit.tool === "text") {
        event.currentTarget.setPointerCapture(event.pointerId);
        setEditingTextId(null);
        rememberUndo();
        setEditInteractionSync({ id: hit.id, mode: "move", start: point, originalPoints: hit.points });
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setEditingTextId(null);
      rememberUndo();
      setEditInteractionSync({ id: hit.id, mode: "move", start: point, originalPoints: hit.points });
      return;
    }

    setEditingTextId(null);
    setSelectedAnnotationIdSync(null);
    if (activeTool === "select") {
      if (event.button === 0) beginPan(event);
      return;
    }

    if (activeTool === "text") {
      const id = crypto.randomUUID();
      const annotation: ShotAnnotation = {
        id,
        tool: "text",
        color: draftColor,
        strokeWidth: 1,
        points: normalizeTextBox(point, { x: point.x + Math.max(140, fontSize * 6), y: point.y + fontSize + 20 }, entry),
        text: "",
        fontSize,
      };
      rememberUndo();
      changeAnnotations([...annotationsRef.current, annotation]);
      setSelectedAnnotationIdSync(id);
      setEditingTextId(id);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setPendingDrawSync({ start: point });
  };

  const continueDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (!entry) return;
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pinch = pinchInteractionRef.current;
      const gesture = touchGesture();
      if (pinch && gesture) {
        event.preventDefault();
        zoomTo(pinch.zoom * (gesture.distance / pinch.distance), gesture.center);
        return;
      }
      if (touchPointsRef.current.size > 1) return;
    }
    const activePan = panInteractionRef.current;
    const activeEdit = editInteractionRef.current;
    const activePending = pendingDrawRef.current;
    const activeDrawingId = drawingIdRef.current;
    if (activePan) {
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = activePan.scrollLeft - (event.clientX - activePan.x);
        viewport.scrollTop = activePan.scrollTop - (event.clientY - activePan.y);
      }
      return;
    }
    if (activeEdit) {
      const point = pointFromEvent(event);
      if (!point) return;
      const dx = point.x - activeEdit.start.x;
      const dy = point.y - activeEdit.start.y;
      const currentAnnotations = annotationsRef.current;
      changeAnnotations(
        currentAnnotations.map((annotation) => {
          if (annotation.id !== activeEdit.id) return annotation;
          if (activeEdit.mode === "resize-start") {
            const second = activeEdit.originalPoints[1] || activeEdit.originalPoints[0] || point;
            return {
              ...annotation,
              points: annotation.tool === "text"
                ? normalizeTextBox(point, second, entry)
                : [clampPoint(point, entry), second],
            };
          }
          if (activeEdit.mode === "resize") {
            const first = activeEdit.originalPoints[0] || point;
            const next = { ...annotation, points: [first, clampPoint(point, entry)] };
            return annotation.tool === "text" ? resizeTextBounds(annotation, point, entry) : next;
          }
          return translateAnnotation(annotation, activeEdit.originalPoints, dx, dy, entry);
        }),
      );
      return;
    }
    if (activePending) {
      const point = pointFromEvent(event);
      if (!point || distanceBetween(activePending.start, point) < MIN_DRAW_DISTANCE) return;
      if (activeTool === "select" || activeTool === "text") return;
      const id = crypto.randomUUID();
      const annotation: ShotAnnotation = {
        id,
        tool: activeTool,
        color: activeTool === "blur" ? "#64748b" : draftColor,
        strokeWidth: activeTool === "blur" ? 1 : strokeWidth,
        blurPixelSize: activeTool === "blur" ? Math.max(4, strokeWidth) : undefined,
        points: [activePending.start, point],
      };
      rememberUndo();
      changeAnnotations([...annotationsRef.current, annotation]);
      setPendingDrawSync(null);
      setDrawingIdSync(id);
      setSelectedAnnotationIdSync(id);
      return;
    }
    if (!activeDrawingId) return;
    const point = pointFromEvent(event);
    if (!point) return;
    const currentAnnotations = annotationsRef.current;
    changeAnnotations(
      currentAnnotations.map((annotation) => {
        if (annotation.id !== activeDrawingId) return annotation;
        if (annotation.tool === "pen") return { ...annotation, points: [...annotation.points, point] };
        return { ...annotation, points: [annotation.points[0] || point, point] };
      }),
    );
  };

  const finishDrawing = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) pinchInteractionRef.current = null;
    }
    if (!drawingIdRef.current && !editInteractionRef.current && !pendingDrawRef.current && !panInteractionRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrawingIdSync(null);
    setPendingDrawSync(null);
    setEditInteractionSync(null);
    setPanInteractionSync(null);
  };

  const setActiveToolAndSync = (tool: EditorTool) => {
    setActiveTool(tool);
    setEditingTextId(null);
    if (selectedAnnotation && selectedAnnotation.tool === tool) {
      setDraftColor(selectedAnnotation.color);
      setStrokeWidth(tool === "blur" ? selectedAnnotation.blurPixelSize ?? selectedAnnotation.strokeWidth : selectedAnnotation.strokeWidth);
      if (selectedAnnotation.fontSize) setFontSize(selectedAnnotation.fontSize);
    } else if (tool === "blur") {
      setStrokeWidth(DEFAULT_BLUR_PIXEL_SIZE);
    }
  };

  const updateColor = (color: string) => {
    setDraftColor(color);
    if (selectedAnnotationIdRef.current) updateAnnotationWithUndo(selectedAnnotationIdRef.current, (annotation) => ({ ...annotation, color: annotation.tool === "blur" ? annotation.color : color }));
  };

  const updateStrokeWidth = (width: number) => {
    setStrokeWidth(width);
    if (selectedAnnotationIdRef.current) {
      updateAnnotationWithUndo(selectedAnnotationIdRef.current, (annotation) => annotation.tool === "blur"
        ? { ...annotation, blurPixelSize: width }
        : annotation.tool === "text" ? annotation : { ...annotation, strokeWidth: width });
    }
  };

  const updateFontSize = (size: number) => {
    setFontSize(size);
    if (selectedAnnotationIdRef.current) updateAnnotationWithUndo(selectedAnnotationIdRef.current, (annotation) => (annotation.tool === "text" ? resizeTextAnnotation({ ...annotation, fontSize: size }, null, entry, zoomScale) : annotation));
  };

  const updateTextBox = (id: string, text: string, element?: HTMLTextAreaElement | null) => {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    if (!entry || !annotation) {
      updateAnnotation(id, (item) => ({ ...item, text }));
      return;
    }
    updateAnnotation(id, (item) => resizeTextAnnotation({ ...item, text }, element || null, entry, zoomScale));
  };

  const commitTextEdit = (id: string, element?: HTMLTextAreaElement | null) => {
    const annotation = annotationsRef.current.find((item) => item.id === id);
    if (!annotation || annotation.tool !== "text") {
      setEditingTextId(null);
      return;
    }
    // Read from the control on both blur and Enter so the final keystroke is committed.
    updateTextBox(id, element?.value ?? annotation.text ?? "", element);
    const committed = annotationsRef.current.find((item) => item.id === id);
    if (committed?.tool === "text" && !committed.text?.trim()) {
      removeAnnotation(id, false);
      return;
    }
    setEditingTextId(null);
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous) return;
    const nextStack = undoStack.slice(0, -1);
    setUndoStack(nextStack);
    changeAnnotations(cloneAnnotations(previous));
    setSelectedAnnotationIdSync(previous.at(-1)?.id ?? null);
    setEditingTextId(null);
  };

  const clear = () => {
    rememberUndo();
    changeAnnotations([]);
    setSelectedAnnotationIdSync(null);
    setEditingTextId(null);
  };

  const applyCurrent = async () => {
    if (!canApply) return;
    await onApply(annotationsRef.current);
    setAnnotationsDirty(false);
  };

  const captureZoomAnchor = (anchor?: ZoomAnchor): ZoomAnchorSnapshot | null => {
    const viewport = viewportRef.current;
    const canvasRect = getCanvasDisplayRect();
    if (!viewport || !canvasRect) return null;
    const viewportRect = viewport.getBoundingClientRect();
    const clientX = anchor?.clientX ?? viewportRect.left + viewport.clientWidth / 2;
    const clientY = anchor?.clientY ?? viewportRect.top + viewport.clientHeight / 2;
    return {
      clientX,
      clientY,
      ratioX: canvasRect.width ? (clientX - canvasRect.left) / canvasRect.width : 0.5,
      ratioY: canvasRect.height ? (clientY - canvasRect.top) / canvasRect.height : 0.5,
    };
  };

  const restoreZoomAnchor = (anchor: ZoomAnchorSnapshot | null) => {
    if (!anchor) return;
    if (zoomAnchorFrameRef.current !== null) window.cancelAnimationFrame(zoomAnchorFrameRef.current);
    zoomAnchorFrameRef.current = window.requestAnimationFrame(() => {
      zoomAnchorFrameRef.current = null;
      const viewport = viewportRef.current;
      const after = getCanvasDisplayRect();
      if (!viewport || !after) return;
      const desiredLeft = anchor.clientX - anchor.ratioX * after.width;
      const desiredTop = anchor.clientY - anchor.ratioY * after.height;
      viewport.scrollLeft += after.left - desiredLeft;
      viewport.scrollTop += after.top - desiredTop;
    });
  };

  const zoomTo = (next: number | "fit", anchor?: ZoomAnchor) => {
    const anchorSnapshot = captureZoomAnchor(anchor);
    if (next === "fit") {
      setZoomMode("fit");
    } else {
      setZoomMode("manual");
      setManualZoom(Math.max(MIN_MANUAL_ZOOM, Math.min(MAX_MANUAL_ZOOM, next)));
    }
    restoreZoomAnchor(anchorSnapshot);
  };

  const zoomBy = (factor: number, anchor?: ZoomAnchor) => {
    const currentZoom = zoomMode === "fit" ? zoomScale : manualZoom;
    zoomTo(currentZoom * factor, anchor);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    // Preview uses the natural wheel gesture; editing keeps Ctrl/Cmd explicit so drawing is safe.
    if (mode !== "preview" && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9, { clientX: event.clientX, clientY: event.clientY });
  };

  const handleViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const activePan = panInteractionRef.current;
    if (!activePan) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollLeft = activePan.scrollLeft - (event.clientX - activePan.x);
    viewport.scrollTop = activePan.scrollTop - (event.clientY - activePan.y);
  };

  const handleViewportPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (viewportRef.current?.hasPointerCapture(event.pointerId)) viewportRef.current.releasePointerCapture(event.pointerId);
    setPanInteractionSync(null);
  };

  const handleViewportPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.button === 1 || spacePressed) beginPan(event);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("[data-editor-inline-text]"));
      const commandKey = event.ctrlKey || event.metaKey;
      if (event.code === "Space" && !typing) {
        event.preventDefault();
        setSpacePressed(true);
        return;
      }
      if (!typing && commandKey && event.key === "0") {
        event.preventDefault();
        zoomTo("fit");
        return;
      }
      if (!typing && commandKey && event.key === "1") {
        event.preventDefault();
        zoomTo(1);
        return;
      }
      if (!typing && (event.key === "+" || event.key === "=")) {
        event.preventDefault();
        zoomBy(1.1);
        return;
      }
      if (!typing && event.key === "-") {
        event.preventDefault();
        zoomBy(0.9);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c" && !typing) {
        if (copySelectedAnnotation()) event.preventDefault();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v" && !typing) {
        if (pasteCopiedAnnotation()) event.preventDefault();
        return;
      }
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
      if (event.key === "Enter" && !typing && selectedAnnotation?.tool === "text") {
        event.preventDefault();
        setEditingTextId(selectedAnnotation.id);
        return;
      }
      if (event.key === "Enter" && !typing && canApply) {
        event.preventDefault();
        void applyCurrent();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [annotations, canApply, entry, manualZoom, onApply, selectedAnnotation, selectedAnnotationId, undoStack, zoomMode, zoomScale]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="grid min-h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b bg-card/95 px-4 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{entry ? text.title : text.emptyTitle}</p>
          <p className="truncate text-xs text-muted-foreground">{entry ? imagePathDisplay : loadError || text.emptySubtitle}</p>
        </div>

        {mode === "edit" ? (
          <ToolRail activeTool={activeTool} labels={text.tools} onSelect={setActiveToolAndSync} />
        ) : (
          <Badge>{text.previewMode}</Badge>
        )}

        <div className="flex justify-end gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-background/70 px-1">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={text.zoomOut} title={text.zoomOut} onClick={() => zoomBy(0.9)}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button type="button" className="min-w-14 rounded-md px-2 py-1 text-xs font-medium tabular-nums hover:bg-accent" onClick={() => zoomMode === "fit" ? zoomTo(1) : zoomTo("fit")} title={zoomMode === "fit" ? text.zoomReset : text.fit}>
              {zoomMode === "fit" ? text.fit : `${Math.round(manualZoom * 100)}%`}
            </button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={text.zoomIn} title={text.zoomIn} onClick={() => zoomBy(1.1)}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={text.fit} title={text.fit} onClick={() => zoomTo("fit")}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label={text.reload} title={text.reload} onClick={onReload}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          {mode === "preview" ? (
            <Button type="button" size="icon" variant="ghost" aria-label={text.edit} title={text.edit} onClick={() => onModeChange("edit")}>
              <Edit3 className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button type="button" size="icon" variant="ghost" aria-label={text.undo} title={`${text.undo} (Ctrl+Z)`} disabled={!undoStack.length} onClick={undo}>
                <ArrowUpRight className="h-4 w-4 rotate-180" />
              </Button>
              <Button type="button" size="icon" variant="ghost" aria-label={text.clear} title={text.clear} disabled={!annotations.length} onClick={clear}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button type="button" disabled={!canApply} onClick={() => void applyCurrent()}>
                <Check className="h-4 w-4" /> {text.apply}
              </Button>
            </>
          )}
        </div>
      </header>

      {mode === "edit" && (
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
          text={text}
        />
      )}

      <section className="min-h-0 flex-1 overflow-hidden p-4">
        <div
          ref={viewportRef}
          className={cn("relative h-full touch-none overflow-auto rounded-lg border bg-card/40 p-4", spacePressed ? "cursor-grab" : "")}
          onWheel={handleWheel}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
           onPointerCancel={() => {
             setPanInteractionSync(null);
             touchPointsRef.current.clear();
             pinchInteractionRef.current = null;
           }}
        >
          <div className="grid min-h-full min-w-full place-items-center">
            {entry && fileMissing ? (
              <EditorState icon={Image} title={text.localFileMissing} description={text.localFileMissingDescription} />
            ) : entry && imageUrl ? (
              <div
                ref={canvasRef}
                data-editor-canvas
                 className={cn("relative shrink-0 select-none overflow-hidden rounded-md border bg-background shadow-xl", spacePressed ? "cursor-grabbing" : mode === "preview" || (activeTool === "select" && zoomMode === "manual") ? "cursor-grab" : activeTool === "select" ? "cursor-default" : "cursor-crosshair")}
                style={{ width: entry.width * zoomScale, height: entry.height * zoomScale }}
                onPointerDown={startDrawing}
                onPointerMove={continueDrawing}
                onPointerUp={finishDrawing}
                 onPointerCancel={() => {
                   setDrawingIdSync(null);
                   setPendingDrawSync(null);
                   setEditInteractionSync(null);
                   setPanInteractionSync(null);
                   touchPointsRef.current.clear();
                   pinchInteractionRef.current = null;
                 }}
                 onLostPointerCapture={() => {
                   setDrawingIdSync(null);
                   setPendingDrawSync(null);
                   setEditInteractionSync(null);
                   setPanInteractionSync(null);
                   touchPointsRef.current.clear();
                   pinchInteractionRef.current = null;
                 }}
              >
                <img src={imageUrl} alt="" decoding="async" draggable={false} className="absolute inset-0 h-full w-full select-none object-fill" />
                {mode === "edit" && annotations.map((annotation, index) => (
                  <AnnotationPreview
                    key={annotation.id}
                    entry={entry}
                    annotation={annotation}
                    displayScale={zoomScale}
                    fallbackOffset={index}
                    selected={selectedAnnotationId === annotation.id}
                    editing={editingTextId === annotation.id}
                    textInputRef={editingTextId === annotation.id ? textInputRef : undefined}
                    onTextChange={(value, element) => updateTextBox(annotation.id, value, element)}
                    onTextCommit={(element) => commitTextEdit(annotation.id, element)}
                    onTextCancel={() => removeAnnotation(annotation.id)}
                    onTextEdit={() => setEditingTextId(annotation.id)}
                  />
                ))}
              </div>
            ) : (
              <EditorState
                icon={Image}
                title={status === "Empty" ? text.noScreenshot : imageFailed ? text.previewUnavailable : text.loading}
                description={
                  status === "Empty"
                    ? text.emptyDescription
                    : imageFailed
                      ? text.previewUnavailableDescription
                      : entry
                        ? `${entry.width} x ${entry.height}`
                        : loadError || text.preparing
                }
              />
            )}
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
            <Badge>{status}</Badge>
            {selectedAnnotation && <Badge>{selectedAnnotation.tool}</Badge>}
            {annotations.length > 0 && <Badge>{normalizeAnnotations(annotations).length} {text.pending}</Badge>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ToolRail({
  activeTool,
  labels,
  onSelect,
}: {
  activeTool: EditorTool;
  labels: Record<EditorTool, string>;
  onSelect: (tool: EditorTool) => void;
}) {
  const tools: Array<{ tool: EditorTool; icon: LucideIcon; label: string }> = [
    { tool: "select", icon: MousePointer2, label: labels.select },
    { tool: "rectangle", icon: RectangleHorizontal, label: labels.rectangle },
    { tool: "ellipse", icon: Circle, label: labels.ellipse },
    { tool: "line", icon: Minus, label: labels.line },
    { tool: "arrow", icon: ArrowUpRight, label: labels.arrow },
    { tool: "pen", icon: PenLine, label: labels.pen },
    { tool: "text", icon: Type, label: labels.text },
    { tool: "blur", icon: Layers, label: labels.blur },
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
  text,
}: {
  activeTool: EditorTool;
  selectedAnnotation: ShotAnnotation | null;
  draftColor: string;
  strokeWidth: number;
  fontSize: number;
  editingText: boolean;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFontSizeChange: (size: number) => void;
  onDeleteSelected: () => void;
  text: EditorText;
}) {
  const controlTool = selectedAnnotation?.tool ?? (activeTool === "select" ? null : activeTool);
  const isText = controlTool === "text";
  const isBlur = controlTool === "blur";
  return (
    <div className="flex shrink-0 justify-center border-b bg-background/92 px-4 py-3 backdrop-blur">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-3 rounded-full border bg-card px-3 py-2 shadow-sm">
        {!isBlur && controlTool && (
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
              aria-label={text.customColor}
              className="h-7 w-9 cursor-pointer rounded-full border bg-background p-0"
              type="color"
              value={draftColor}
              onChange={(event) => onColorChange(event.target.value)}
            />
          </div>
        )}

        {!isText && controlTool && (
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isBlur ? text.pixelSize : text.stroke}
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
              {text.textSize}
              <input className="w-32 accent-primary" type="range" min={12} max={64} value={fontSize} onChange={(event) => onFontSizeChange(Number(event.target.value))} />
              <span className="w-9 text-foreground">{fontSize}px</span>
            </label>
            <Badge>{editingText ? text.typing : text.clickToWrite}</Badge>
          </>
        )}

        {!controlTool && <Badge>{text.selectHint}</Badge>}

        {selectedAnnotation && (
          <Button type="button" size="sm" variant="ghost" onClick={onDeleteSelected}>
            <Trash2 className="h-3.5 w-3.5" /> {text.deleteSelected}
          </Button>
        )}
      </div>
    </div>
  );
}

function AnnotationPreview({
  entry,
  annotation,
  displayScale,
  fallbackOffset,
  selected,
  editing,
  textInputRef,
  onTextChange,
  onTextCommit,
  onTextCancel,
  onTextEdit,
}: {
  entry: ShotHistoryEntry | null;
  annotation: ShotAnnotation;
  displayScale: number;
  fallbackOffset: number;
  selected: boolean;
  editing: boolean;
  textInputRef?: RefObject<HTMLTextAreaElement | null>;
  onTextChange: (value: string, element: HTMLTextAreaElement) => void;
  onTextCommit: (element: HTMLTextAreaElement) => void;
  onTextCancel: () => void;
  onTextEdit: () => void;
}) {
  const first = annotation.points[0] || { x: 80 + fallbackOffset * 18, y: 70 + fallbackOffset * 18 };
  const second = annotation.points[1] || { x: first.x + 160, y: first.y + 90 };
  const width = entry?.width || 1280;
  const height = entry?.height || 720;
  const isLineLike = annotation.tool === "pen" || annotation.tool === "line" || annotation.tool === "arrow";
  if (isLineLike) {
    const points = annotation.tool === "pen" ? annotation.points : [first, second];
    const path = points.map((point) => `${point.x},${point.y}`).join(" ");
    const hitStroke = Math.max(18, annotation.strokeWidth + 14, 12 / Math.max(displayScale, 0.05));
    return (
      <>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          <defs>
            <marker id={`arrow-${annotation.id}`} markerWidth="24" markerHeight="18" refX="22" refY="9" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0 L0,18 L22,9 z" fill={annotation.color} />
            </marker>
          </defs>
          {annotation.tool === "pen" ? (
            <polyline
              data-editor-hit={annotation.id}
              data-editor-id={annotation.id}
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
              data-editor-id={annotation.id}
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
                data-editor-id={annotation.id}
                aria-label={index === 0 ? "Move start point" : "Move end point"}
                onPointerDown={(event) => event.preventDefault()}
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
  const isText = annotation.tool === "text";
  const isEllipse = annotation.tool === "ellipse";
  const isBlur = annotation.tool === "blur";
  const textMinWidthSource = Math.min(MIN_TEXT_WIDTH, width);
  const textMinHeightSource = Math.min(MIN_TEXT_HEIGHT, height);
  const sourceBoxWidth = isText ? Math.max(textMinWidthSource, Math.abs(second.x - first.x)) : Math.abs(second.x - first.x);
  const sourceBoxHeight = isText ? Math.max(textMinHeightSource, Math.abs(second.y - first.y)) : Math.abs(second.y - first.y);
  const boxWidth = `${(sourceBoxWidth / width) * 100}%`;
  const boxHeight = `${(sourceBoxHeight / height) * 100}%`;
  const pixelSize = Math.max(4, Math.min(48, annotation.blurPixelSize ?? annotation.strokeWidth ?? DEFAULT_BLUR_PIXEL_SIZE));
  const safeDisplayScale = Math.max(displayScale, 0.05);
  const textFontSize = clampTextFontSize(annotation.fontSize) * safeDisplayScale;
  const textMinWidth = textMinWidthSource * safeDisplayScale;
  const textMinHeight = textMinHeightSource * safeDisplayScale;
  const textPaddingX = 8 * safeDisplayScale;
  const textPaddingY = 4 * safeDisplayScale;
  const textStyle = {
    color: annotation.color,
    fontFamily: "AtrisShotAnnotation, Arial, Helvetica, sans-serif",
    fontSize: `${textFontSize}px`,
    fontWeight: 400,
    lineHeight: 1.25,
    minWidth: `${textMinWidth}px`,
    minHeight: `${textMinHeight}px`,
    padding: `${textPaddingY}px ${textPaddingX}px`,
    borderRadius: `${6 * safeDisplayScale}px`,
    boxSizing: "border-box" as const,
  };
  const displayPixelSize = pixelSize * safeDisplayScale;

  if (isText && editing) {
    return (
      <textarea
        ref={textInputRef}
        data-editor-inline-text
        aria-label="Annotation text"
        value={annotation.text || ""}
        placeholder="Type..."
        onChange={(event) => onTextChange(event.target.value, event.currentTarget)}
        onBlur={(event) => onTextCommit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onTextCancel();
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onTextCommit(event.currentTarget);
          }
        }}
        className="absolute z-20 resize-none overflow-hidden rounded-md border bg-background/95 font-normal outline-none ring-2 ring-ring shadow-xl"
        style={{
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          borderColor: annotation.color,
          borderWidth: safeDisplayScale,
          ...textStyle,
        }}
      />
    );
  }

  return (
    <>
      <div
        data-editor-hit={annotation.id}
        data-editor-id={annotation.id}
        onDoubleClick={isText ? onTextEdit : undefined}
        className={cn("pointer-events-auto absolute cursor-move", isEllipse ? "rounded-full" : "rounded")}
        style={{ left, top, width: boxWidth, height: boxHeight, borderRadius: isEllipse ? "50%" : `${4 * safeDisplayScale}px` }}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute bg-background/10 font-normal",
          isEllipse ? "rounded-full" : "rounded",
          isText && "whitespace-pre-wrap break-words leading-tight",
          selected && "shadow-[0_0_0_2px_rgb(255_255_255_/_0.85)]",
        )}
        style={{
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          overflow: isText ? "hidden" : undefined,
          minWidth: isText ? `${textMinWidth}px` : undefined,
          minHeight: isText ? `${textMinHeight}px` : undefined,
          borderColor: annotation.color,
          borderStyle: "solid",
          borderWidth: isText ? (selected ? safeDisplayScale : 0) : isBlur ? 0 : annotation.strokeWidth * safeDisplayScale,
          borderRadius: isEllipse ? "50%" : `${4 * safeDisplayScale}px`,
          boxShadow: selected ? `0 0 0 ${2 * safeDisplayScale}px rgb(255 255 255 / 0.85)` : undefined,
          color: annotation.color,
          fontFamily: isText ? "AtrisShotAnnotation, Arial, Helvetica, sans-serif" : undefined,
          fontWeight: isText ? 400 : undefined,
          backgroundColor: isBlur ? "rgb(100 116 139 / 0.18)" : undefined,
          backgroundImage: isBlur
            ? `linear-gradient(45deg, rgb(255 255 255 / 0.16) 25%, transparent 25%, transparent 75%, rgb(255 255 255 / 0.16) 75%), linear-gradient(45deg, rgb(0 0 0 / 0.16) 25%, transparent 25%, transparent 75%, rgb(0 0 0 / 0.16) 75%)`
            : undefined,
          backgroundPosition: isBlur ? `0 0, ${displayPixelSize / 2}px ${displayPixelSize / 2}px` : undefined,
          backgroundSize: isBlur ? `${displayPixelSize}px ${displayPixelSize}px` : undefined,
          backdropFilter: isBlur ? `blur(${Math.min(10, pixelSize / 4) * safeDisplayScale}px)` : undefined,
          ...(isText ? textStyle : {}),
        }}
      >
        {isText ? annotation.text || "Text" : null}
        {selected && (
          <>
            <button
              type="button"
              data-editor-handle="move"
              data-editor-id={annotation.id}
              aria-label="Move selected annotation"
              title="Move"
              onPointerDown={(event) => event.preventDefault()}
              className="pointer-events-auto absolute -left-2 -top-2 h-4 w-4 cursor-move rounded-full border border-background bg-primary shadow"
            />
            <button
              type="button"
              data-editor-handle="resize"
              data-editor-id={annotation.id}
              aria-label="Resize selected annotation"
              title="Resize"
              onPointerDown={(event) => event.preventDefault()}
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

function translateAnnotation(
  annotation: ShotAnnotation,
  originalPoints: Array<{ x: number; y: number }>,
  dx: number,
  dy: number,
  entry: ShotHistoryEntry,
) {
  if (!originalPoints.length) return annotation;
  const minX = Math.min(...originalPoints.map((point) => point.x));
  const maxX = Math.max(...originalPoints.map((point) => point.x));
  const minY = Math.min(...originalPoints.map((point) => point.y));
  const maxY = Math.max(...originalPoints.map((point) => point.y));
  const boundedDx = Math.max(-minX, Math.min(entry.width - maxX, dx));
  const boundedDy = Math.max(-minY, Math.min(entry.height - maxY, dy));
  return {
    ...annotation,
    points: originalPoints.map((point) => ({
      x: Math.round(point.x + boundedDx),
      y: Math.round(point.y + boundedDy),
    })),
  };
}

function resizeTextAnnotation(
  annotation: ShotAnnotation,
  element: HTMLTextAreaElement | null,
  entry: ShotHistoryEntry | null,
  displayScale = 1,
) {
  if (annotation.tool !== "text" || !entry) return annotation;
  const first = annotation.points[0] || { x: 0, y: 0 };
  const second = annotation.points[1] || { x: first.x + 180, y: first.y + 48 };
  const minWidth = Math.min(MIN_TEXT_WIDTH, entry.width);
  const minHeight = Math.min(MIN_TEXT_HEIGHT, entry.height);
  const width = Math.max(minWidth, Math.abs(second.x - first.x));
  const fontSize = clampTextFontSize(annotation.fontSize);
  const safeDisplayScale = Math.max(displayScale, 0.05);
  let height = estimateTextHeight(annotation.text || "", width, fontSize);

  if (element) {
    element.style.height = "auto";
    const measuredDisplayHeight = Math.max(minHeight * safeDisplayScale, element.scrollHeight);
    height = Math.max(height, Math.ceil(measuredDisplayHeight / safeDisplayScale));
  }

  return {
    ...annotation,
    points: normalizeTextBox(first, { x: first.x + width, y: first.y + height }, entry),
  };
}

function resizeTextBounds(annotation: ShotAnnotation, point: { x: number; y: number }, entry: ShotHistoryEntry | null) {
  if (annotation.tool !== "text" || !entry) return annotation;
  const first = annotation.points[0] || point;
  const width = Math.max(Math.min(MIN_TEXT_WIDTH, entry.width), Math.abs(point.x - first.x));
  const fontSize = clampTextFontSize(annotation.fontSize);
  const contentHeight = estimateTextHeight(annotation.text || "", width, fontSize);
  return {
    ...annotation,
    points: normalizeTextBox(first, { x: first.x + width, y: Math.max(first.y + contentHeight, point.y) }, entry),
  };
}

function normalizeTextBox(first: { x: number; y: number }, second: { x: number; y: number }, entry: ShotHistoryEntry) {
  const minWidth = Math.min(MIN_TEXT_WIDTH, entry.width);
  const minHeight = Math.min(MIN_TEXT_HEIGHT, entry.height);
  const left = Math.max(0, Math.min(Math.max(0, entry.width - minWidth), Math.min(first.x, second.x)));
  const top = Math.max(0, Math.min(Math.max(0, entry.height - minHeight), Math.min(first.y, second.y)));
  const right = Math.min(entry.width, Math.max(left + minWidth, Math.max(first.x, second.x)));
  const bottom = Math.min(entry.height, Math.max(top + minHeight, Math.max(first.y, second.y)));
  return [{ x: Math.round(left), y: Math.round(top) }, { x: Math.round(right), y: Math.round(bottom) }];
}

function clampTextFontSize(fontSize?: number) {
  return Math.max(MIN_TEXT_FONT_SIZE, Math.min(MAX_TEXT_FONT_SIZE, fontSize || 24));
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

function distanceBetween(first: { x: number; y: number }, second: { x: number; y: number }) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function formatPathForDisplay(path: string) {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice("\\\\?\\UNC\\".length)}`;
  if (path.startsWith("\\\\?\\")) return path.slice("\\\\?\\".length);
  return path;
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

function findAnnotationAtPoint(annotations: ShotAnnotation[], point: { x: number; y: number }, displayScale = 1) {
  for (const annotation of [...annotations].reverse()) {
    const first = annotation.points[0];
    if (!first) continue;
    if (annotation.tool === "pen" || annotation.tool === "arrow" || annotation.tool === "line") {
      const points = annotation.tool === "pen" ? annotation.points : [annotation.points[0], annotation.points[1]].filter(Boolean);
      const lineTolerance = Math.max(18, annotation.strokeWidth + 14, 10 / Math.max(displayScale, 0.05));
      for (const candidate of points) {
        if (Math.abs(candidate.x - point.x) <= lineTolerance && Math.abs(candidate.y - point.y) <= lineTolerance) return annotation;
      }
      for (let index = 0; index < points.length - 1; index += 1) {
        if (distanceToSegment(point, points[index], points[index + 1]) <= lineTolerance) return annotation;
      }
      continue;
    }
    const second = annotation.points[1] || { x: first.x + 120, y: first.y + 60 };
    const tolerance = Math.max(14, annotation.strokeWidth + 10, 10 / Math.max(displayScale, 0.05));
    const left = Math.min(first.x, second.x) - tolerance;
    const right = Math.max(first.x, second.x) + tolerance;
    const top = Math.min(first.y, second.y) - tolerance;
    const bottom = Math.max(first.y, second.y) + tolerance;
    if (point.x >= left && point.x <= right && point.y >= top && point.y <= bottom) return annotation;
  }
  return null;
}
