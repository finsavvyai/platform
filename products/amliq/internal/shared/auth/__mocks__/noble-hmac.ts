import { createHmac } from 'crypto';

export function hmac(
  hashFn: (data: Uint8Array) => Uint8Array,
  key: Uint8Array,
  message: Uint8Array,
): Uint8Array {
  const mac = createHmac('sha256', key);
  mac.update(message);
  return new Uint8Array(mac.digest());
}
