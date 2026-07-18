import assert from "node:assert/strict";
import { normalizeDesktopSettings } from "../apps/desktop/src/lib/settings-normalization.ts";

const fresh = normalizeDesktopSettings({});
assert.equal(fresh.clipboardMode, "off");
assert.equal(fresh.overlayVisibilityMode, "edge-auto-hide");
assert.equal(fresh.overlayShortcut, "Ctrl+Shift+O");

for (const clipboardMode of ["off", "image", "path"]) {
  assert.equal(normalizeDesktopSettings({ clipboardMode }).clipboardMode, clipboardMode);
}

assert.equal(normalizeDesktopSettings({ clipboardMode: "legacy" }).clipboardMode, "off");
assert.equal(normalizeDesktopSettings({ overlayVisibilityMode: "always-visible" }).overlayVisibilityMode, "always-visible");
assert.equal(normalizeDesktopSettings({ overlayVisibilityMode: "shortcut-only" }).overlayVisibilityMode, "shortcut-only");
assert.equal(normalizeDesktopSettings({ overlayShortcut: "Ctrl+Alt+O" }).overlayShortcut, "Ctrl+Alt+O");

console.log("AtrisShot settings normalization checks passed.");
