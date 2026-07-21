export type ClipboardMode = "image" | "path" | "off";
export type PostCaptureAction = "corner-overlay" | "open-editor" | "save-silently";
export type OverlayCorner = "bottom-left" | "bottom-right" | "top-left" | "top-right";
export type OverlayVisibilityMode = "edge-auto-hide" | "always-visible" | "shortcut-only";
export type CaptureMode = "display" | "region" | "window";

export interface ShotSettings {
  shortcut: string;
  saveFolder: string;
  clipboardMode: ClipboardMode;
  postCaptureAction: PostCaptureAction;
  overlayCorner: OverlayCorner;
  overlayVisibilityMode: OverlayVisibilityMode;
  overlayShortcut: string;
  includeCursor: boolean;
  captureDelayMs: number;
  historyLimit: number;
}

export interface DisplayInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
}

export interface VirtualDisplayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureOverlayOpenedPayload {
  displays: DisplayInfo[];
  bounds: VirtualDisplayBounds;
}

export interface CaptureRegion {
  displayId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowTarget {
  windowId: string;
  title: string;
  region: CaptureRegion;
}

export interface ShotHistoryEntry {
  id: string;
  createdAt: string;
  mode: CaptureMode;
  originalPath: string;
  editedPath?: string;
  thumbnailPath?: string;
  width: number;
  height: number;
  displayName: string;
  region: CaptureRegion;
  annotationsCount: number;
  editRevision: number;
  annotations?: ShotAnnotation[];
}

export type ShotHistoryEventKind = "created" | "updated";

export interface ShotHistoryEvent {
  kind: ShotHistoryEventKind;
  entry: ShotHistoryEntry;
}

export type AnnotationTool = "rectangle" | "ellipse" | "line" | "arrow" | "pen" | "text" | "blur";

export interface ShotAnnotation {
  id: string;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  blurPixelSize?: number;
  points: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
}

export interface CaptureRequest {
  mode: CaptureMode;
  displayId?: string;
  region?: CaptureRegion;
  windowId?: string;
  saveFolder?: string;
  clipboardMode?: ClipboardMode;
  postCaptureAction?: PostCaptureAction;
  overlayCorner?: OverlayCorner;
  includeCursor?: boolean;
  captureDelayMs?: number;
  historyLimit?: number;
}

export interface CaptureResult {
  entry: ShotHistoryEntry;
  copiedImage: boolean;
  copiedPath: boolean;
}

export interface PublicHealthResponse {
  status: "ok";
  service: "atris-shot-public";
}

export const DEFAULT_SHOT_SETTINGS: ShotSettings = {
  shortcut: "Ctrl+Shift+S",
  saveFolder: "",
  clipboardMode: "off",
  postCaptureAction: "corner-overlay",
  overlayCorner: "bottom-left",
  overlayVisibilityMode: "edge-auto-hide",
  overlayShortcut: "Ctrl+Shift+O",
  includeCursor: false,
  captureDelayMs: 0,
  historyLimit: 100,
};
