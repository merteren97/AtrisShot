import { AuthShell } from "@/components/auth-shell";
import { DesktopUpdater } from "@/components/desktop-updater";

export default function DesktopHome() {
  return (
    <>
      <DesktopUpdater />
      <AuthShell />
    </>
  );
}
