/**
 * Console logging for the Bluetooth layer, to follow a link from connect to messages.
 * On in development; in production run `localStorage.setItem("bleDebug", "1")` and reload.
 * Filter the console by "[BLE]".
 */
function isEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("bleDebug") === "1";
  } catch {
    return false;
  }
}

const enabled = typeof window !== "undefined" && isEnabled();

export function bleLog(scope: string, message: string, ...details: unknown[]): void {
  if (enabled) console.log(`[BLE] ${scope}: ${message}`, ...details);
}
