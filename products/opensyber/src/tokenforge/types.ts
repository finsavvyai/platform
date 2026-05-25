/** TokenForge device-bound session types */

export interface DeviceBinding {
  deviceId: string;
  publicKey: string;
  algorithm: string;
  createdAt: Date;
  fingerprint: string;
}

export interface SessionToken {
  id: string;
  token: string;
  deviceId: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
  signature?: string;
  lastActivity?: Date;
  refreshCount?: number;
}

export interface ECDSASignature {
  r: string;
  s: string;
  algorithm: string;
}
