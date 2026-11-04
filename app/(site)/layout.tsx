import { UnloadGuard } from "@/components/bluetooth/unload-guard";
import { AppUpdater } from "@/components/providers/app-updater";
import { ErrorToast } from "@/components/providers/error-toast";
import { OfflineNavigation } from "@/components/providers/offline-navigation";
import { SessionWatcher } from "@/components/providers/session-watcher";
import { Footer } from "@/components/layout/footer";
import { TopNav } from "@/components/layout/top-nav";

// The app itself, behind the site password (see proxy.ts). /admin sits outside this group,
// so it has none of this: no service worker, no session checks, no Bluetooth.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      {children}
      <Footer />
      <AppUpdater />
      <ErrorToast />
      <OfflineNavigation />
      <SessionWatcher />
      <UnloadGuard />
    </>
  );
}
