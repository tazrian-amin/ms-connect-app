const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function decodeText(value: DataView): string {
  return decoder.decode(value).replace(/\0+$/, "");
}

export function encodeText(text: string): Uint8Array<ArrayBuffer> {
  return encoder.encode(text);
}

/** Hex dump such as "0a ff 3c", handy for logging raw packets during development. */
export function toHex(value: DataView): string {
  return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join(" ");
}
