const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const base64UrlEncode = (input: Uint8Array | string): string => {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const base64UrlDecode = (input: string): Uint8Array => {
  const padded = input
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const base64UrlDecodeString = (input: string): string =>
  decoder.decode(base64UrlDecode(input));

export const randomTokenId = (bytes: number = 16): string => {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr);
};

export const sha256Hex = async (input: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
