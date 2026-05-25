declare module "@noble/hashes/sha256" {
  export function sha256(data: Uint8Array): Uint8Array;
}

declare module "@noble/hashes/hmac" {
  export function hmac(
    hash: (data: Uint8Array) => Uint8Array,
    key: Uint8Array,
    data: Uint8Array
  ): Uint8Array;
}
