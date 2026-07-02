"use client";

import { useState } from "react";
import { Keyboard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const modifierKeys = new Set(["Control", "Shift", "Alt", "Meta"]);

const normalizeMainKey = (event: React.KeyboardEvent) => {
  if (event.code === "Space") return "Space";
  if (event.code === "Enter") return "Enter";
  if (event.code === "Tab") return "Tab";
  if (event.code === "Backspace") return "Backspace";
  if (event.code === "Delete") return "Delete";
  if (event.code.startsWith("Arrow")) return event.code;
  if (/^F([1-9]|1\d|2[0-4])$/.test(event.key)) return event.key.toUpperCase();
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3);
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  return event.key.length === 1 ? event.key.toUpperCase() : "";
};

const shortcutFromEvent = (event: React.KeyboardEvent) => {
  const main = normalizeMainKey(event);
  if (!main || modifierKeys.has(event.key)) return "";
  const parts = [
    event.ctrlKey ? "Ctrl" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey ? "Shift" : "",
    event.metaKey ? "Super" : "",
  ].filter(Boolean);
  if (parts.length === 0 && !/^F([1-9]|1\d|2[0-4])$/.test(main)) return "";
  const value = [...parts, main].join("+");
  if (["Alt+F4", "Ctrl+Alt+Delete", "Super+L"].includes(value)) return "";
  return value;
};

export function ShortcutRecorder({
  value,
  defaultValue,
  disabled,
  recordingLabel,
  invalidLabel,
  resetLabel,
  onChange,
}: {
  value: string;
  defaultValue: string;
  disabled?: boolean;
  recordingLabel: string;
  invalidLabel: string;
  resetLabel: string;
  onChange: (value: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={recording}
          onClick={() => {
            setInvalid(false);
            setRecording(true);
          }}
          onBlur={() => setRecording(false)}
          onKeyDown={(event) => {
            if (!recording) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.key === "Escape") {
              setRecording(false);
              setInvalid(false);
              return;
            }
            const shortcut = shortcutFromEvent(event);
            if (!shortcut) {
              if (!modifierKeys.has(event.key)) setInvalid(true);
              return;
            }
            onChange(shortcut);
            setInvalid(false);
            setRecording(false);
          }}
          className={`flex h-10 min-w-0 flex-1 items-center gap-3 rounded-md border bg-background px-3 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
            recording ? "border-primary ring-2 ring-primary/20" : ""
          }`}
        >
          <Keyboard className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className={recording ? "text-muted-foreground" : "font-medium"}>
            {recording ? recordingLabel : value.replaceAll("+", " + ")}
          </span>
        </button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={resetLabel}
          disabled={disabled || value === defaultValue}
          onClick={() => onChange(defaultValue)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      {invalid && <p className="text-xs text-destructive">{invalidLabel}</p>}
    </div>
  );
}
