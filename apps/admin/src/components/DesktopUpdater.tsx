import { UpdateDialog } from "@/components/UpdateDialog";
import { useUpdater } from "@/hooks/useUpdater";

export default function DesktopUpdater() {
  const updater = useUpdater();

  return (
    <UpdateDialog
      {...updater}
      onInstall={() => void updater.installUpdate()}
      onPostpone={updater.postpone}
      onRetry={() => void updater.checkForUpdates(false)}
      onClose={updater.closeDialog}
    />
  );
}
