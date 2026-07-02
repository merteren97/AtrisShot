"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Crop, Download, Edit3, Image, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { AtrisShotMark } from "../components/atris-shot-mark";

type Platform = "windows-x86_64" | "linux-x86_64" | "darwin-x86_64" | "darwin-aarch64";
type Theme = "light" | "dark";

const downloadTargets: Array<{ title: string; detail: string; target: Platform }> = [
  { title: "Windows", detail: "Windows 10/11 x64", target: "windows-x86_64" },
  { title: "macOS", detail: "Apple Silicon", target: "darwin-aarch64" },
  { title: "macOS", detail: "Intel", target: "darwin-x86_64" },
  { title: "Linux", detail: "AppImage / deb x64", target: "linux-x86_64" },
];

function detectPlatform(): Platform {
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (value.includes("linux")) return "linux-x86_64";
  if (value.includes("mac")) return "darwin-aarch64";
  return "windows-x86_64";
}

function platformName(platform: Platform) {
  if (platform === "linux-x86_64") return "Linux";
  if (platform === "darwin-aarch64") return "macOS Apple Silicon";
  if (platform === "darwin-x86_64") return "macOS Intel";
  return "Windows";
}

export default function LandingPage() {
  const [platform, setPlatform] = useState<Platform>("windows-x86_64");
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setPlatform(detectPlatform());
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("atrisshot-site-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const platformLabel = `Download for ${platformName(platform)}`;

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="AtrisShot">
            <AtrisShotMark className="h-11 w-11 rounded-xl" />
            <span className="font-black tracking-[0.08em]">ATRISSHOT</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#workflow" className="transition hover:text-foreground">Workflow</a>
            <a href="#privacy" className="transition hover:text-foreground">Privacy</a>
            <a href="#download" className="transition hover:text-foreground">Download</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleTheme} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground" aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href="#download" className="hidden h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex">
              Download <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:py-24">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Local screenshot workflow</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl">
                Capture, edit, and place screenshots without breaking flow.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
                AtrisShot is a Tauri desktop app for authenticated Atris users. Use one shortcut to capture the focused window, current screen, or an exact dragged region, then copy the image or path into your work.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={`/api/releases/download-platform/${platform}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90">
                  <Download className="h-4 w-4" /> {platformLabel}
                </a>
                <a href="#workflow" className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-card px-6 text-sm font-bold transition hover:bg-accent">
                  See workflow
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Free Atris accounts</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Local history</span>
                <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5 text-primary" /> Signed update path</span>
              </div>
            </div>
            <ProductMockup />
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              [Monitor, "Focused capture", "Click once for the focused window or current screen."],
              [Crop, "Drag a region", "Hold left click and frame the exact area."],
              [Edit3, "Annotate", "Add shapes, arrows, text, pen, or blur."],
              [Copy, "Copy output", "Copy the image or the saved local path."],
            ].map(([Icon, title, description]) => {
              const WorkflowIcon = Icon as typeof Monitor;
              return (
                <article key={String(title)} className="rounded-lg border border-border bg-card p-5">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><WorkflowIcon className="h-5 w-5" /></div>
                  <h3 className="mt-5 font-extrabold">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{String(description)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="privacy" className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Local by default</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">Your screenshots stay on your machine.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["AtrisHub login", "Identity is verified by the existing AtrisHub account system."],
                ["No server history", "Screenshot files, annotations, and paths are local app data."],
                ["Release proxy", "Public service only serves landing, downloads, and signed update metadata."],
              ].map(([title, description]) => (
                <article key={title} className="rounded-lg border border-border bg-background p-5">
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="download" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 text-center sm:px-8">
          <AtrisShotMark className="mx-auto h-14 w-14 rounded-xl" />
          <h2 className="mt-6 text-4xl font-black tracking-tight">Download AtrisShot</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Desktop builds are delivered through signed GitHub Release artifacts and the AtrisShot public release proxy.
          </p>
          <div className="mx-auto mt-9 grid max-w-4xl gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {downloadTargets.map(({ title, detail, target }) => (
              <a key={target} href={`/api/releases/download-platform/${target}`} className="group rounded-lg border border-border bg-card p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <div className="flex items-center justify-between"><Monitor className="h-6 w-6 text-primary" /><Download className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></div>
                <h3 className="mt-5 font-extrabold">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function ProductMockup() {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-2xl shadow-primary/10">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex h-11 items-center justify-between border-b border-border px-4">
          <div className="flex gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-bold text-muted-foreground">AtrisShot</span>
        </div>
        <div className="grid min-h-[380px] grid-cols-[170px_1fr]">
          <aside className="border-r border-border bg-muted/35 p-4">
            <div className="space-y-2 text-sm">
              {["Capture", "History", "Editor", "Settings"].map((item, index) => (
                <div key={item} className={`rounded-md px-3 py-2 ${index === 0 ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{item}</div>
              ))}
            </div>
          </aside>
          <div className="p-5">
            <div className="rounded-lg border-2 border-dashed border-primary/70 bg-primary/5 p-5">
              <div className="flex aspect-video items-center justify-center rounded-md border bg-background">
                <div className="text-center">
                  <Image className="mx-auto h-10 w-10 text-primary" />
                  <p className="mt-3 text-sm font-semibold">Region selected</p>
                  <p className="mt-1 text-xs text-muted-foreground">Copy image or path after capture</p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {["Corner overlay", "Edit tools", "Local history"].map((item) => (
                <div key={item} className="rounded-md border bg-card px-3 py-2 text-xs font-medium">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
