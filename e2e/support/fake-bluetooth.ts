import type { Page } from "@playwright/test";

/*
 * A stand-in for Chrome's Web Bluetooth (navigator.bluetooth), installed before the app loads. Test
 * browsers have no Bluetooth adapter, so this lets a test decide what the adapter and the device
 * chooser do. Real hardware is still tested by hand.
 */
export type FakeBluetoothOptions = {
  /** Whether the adapter reports it is on (getAvailability). */
  available?: boolean;
  /** What the device chooser does: the user closes it, or permission is blocked. */
  chooser?: "cancel" | "blocked";
};

export async function installFakeBluetooth(page: Page, { available = true, chooser = "cancel" }: FakeBluetoothOptions = {}) {
  await page.addInitScript(
    ({ available, chooser }) => {
      const requests: unknown[] = [];
      const bluetooth = Object.assign(new EventTarget(), {
        getAvailability: () => Promise.resolve(available),
        requestDevice: (options: unknown) => {
          requests.push(options);
          return Promise.reject(
            chooser === "cancel"
              ? new DOMException("User cancelled the requestDevice() chooser.", "NotFoundError")
              : new DOMException("Bluetooth permission has been blocked.", "SecurityError"),
          );
        },
      });
      Object.defineProperty(navigator, "bluetooth", { value: bluetooth, configurable: true });
      Object.defineProperty(window, "__bluetoothRequests", { value: requests });
    },
    { available, chooser },
  );
}

/** What the app asked the device chooser for. */
export type ChooserRequest = { filters?: BluetoothLEScanFilter[]; acceptAllDevices?: boolean; optionalServices?: BluetoothServiceUUID[] };

/** The options the app passed to each requestDevice() call so far. */
export function bluetoothRequests(page: Page): Promise<ChooserRequest[]> {
  return page.evaluate(() => (window as unknown as { __bluetoothRequests: ChooserRequest[] }).__bluetoothRequests);
}
