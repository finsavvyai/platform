/**
 * Ed25519 keypair generation, signing, and verification.
 * Uses Node's built-in crypto (libsodium-grade). No new dependencies.
 * Mirrors the TokenForge keypair approach: SPKI for public, PKCS8 for private.
 */

import {
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  createPrivateKey,
  createPublicKey,
} from 'node:crypto'

export interface Ed25519Keypair {
  publicKeyB64: string // SPKI DER, base64
  privateKeyB64: string // PKCS8 DER, base64 (keep out of VCS)
  publicKeyPem: string
  privateKeyPem: string
}

export function generateKeypair(): Ed25519Keypair {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    publicKeyB64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    privateKeyB64: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    privateKeyPem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
  }
}

export function signBytes(payload: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem)
  const sig = nodeSign(null, Buffer.from(payload, 'utf8'), key)
  return sig.toString('base64')
}

export function verifyBytes(payload: string, signatureB64: string, publicKeyB64: string): boolean {
  const der = Buffer.from(publicKeyB64, 'base64')
  const key = createPublicKey({ key: der, format: 'der', type: 'spki' })
  return nodeVerify(null, Buffer.from(payload, 'utf8'), key, Buffer.from(signatureB64, 'base64'))
}
