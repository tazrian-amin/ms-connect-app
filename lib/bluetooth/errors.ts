/** True when the user closed the browser's device chooser without picking anything. */
export function isChooserCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

/** Turns Web Bluetooth's DOMExceptions into messages a field operator can act on. */
export function describeBluetoothError(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : "Unexpected Bluetooth error.";
  }
  switch (error.name) {
    case "NotFoundError":
      return "The device does not offer the expected Bluetooth service.";
    case "SecurityError":
      return "Bluetooth access was blocked. Check the browser's Bluetooth permission for this app.";
    case "NetworkError":
      return "Could not reach the device. Make sure it is powered on and in range.";
    case "NotSupportedError":
      return "The device does not support this operation.";
    case "TimeoutError":
      return "The device did not respond in time.";
    case "InvalidStateError":
      return "The device is not connected.";
    default:
      return error.message || "Unexpected Bluetooth error.";
  }
}
