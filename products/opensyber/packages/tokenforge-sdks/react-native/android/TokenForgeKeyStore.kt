package cloud.opensyber.tokenforge

import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature

/**
 * Hardware-backed ECDSA P-256 key storage for TokenForge on Android.
 *
 * Key hierarchy:
 *  1. StrongBox (dedicated secure element) — preferred
 *  2. TEE (Trusted Execution Environment) — fallback
 *
 * The private key never leaves the hardware module. Callers receive
 * the public key as an uncompressed SEC-1 point (65 bytes: 0x04 || X || Y)
 * and signatures in DER format.
 */
class TokenForgeKeyStore {
    companion object {
        private const val KEY_ALIAS = "tokenforge_device_key"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"

        private var strongBoxUsed = false

        /**
         * Generate an ECDSA P-256 keypair in hardware.
         * Tries StrongBox first; falls back to TEE on older/unsupported devices.
         *
         * @return uncompressed public key bytes (65 bytes)
         */
        fun generateKey(): ByteArray {
            deleteKey()

            val generated = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                tryGenerateWithStrongBox() || generateInTee()
            } else {
                generateInTee()
            }

            if (!generated) {
                throw SecurityException("Failed to generate hardware-backed key")
            }

            return getPublicKeyBytes()
        }

        /**
         * Sign [data] with the hardware-backed private key.
         *
         * @param data raw bytes to sign (the SDK pre-hashes with SHA-256)
         * @return DER-encoded ECDSA signature
         */
        fun sign(data: ByteArray): ByteArray {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)

            val entry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.PrivateKeyEntry
                ?: throw IllegalStateException("TokenForge key not found. Call generateKey() first.")

            val signature = Signature.getInstance("SHA256withECDSA")
            signature.initSign(entry.privateKey)
            signature.update(data)
            return signature.sign()
        }

        /** True if a TokenForge key exists in the Android KeyStore. */
        fun hasHardwareKey(): Boolean {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            return keyStore.containsAlias(KEY_ALIAS)
        }

        /** True if the current key is backed by StrongBox (dedicated SE). */
        fun isStrongBox(): Boolean = strongBoxUsed

        /** Delete the TokenForge key from the Android KeyStore. */
        fun deleteKey() {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            if (keyStore.containsAlias(KEY_ALIAS)) {
                keyStore.deleteEntry(KEY_ALIAS)
            }
            strongBoxUsed = false
        }

        // --- Private helpers ---------------------------------------------------

        private fun tryGenerateWithStrongBox(): Boolean {
            return try {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return false

                val spec = KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
                )
                    .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .setIsStrongBoxBacked(true)
                    .build()

                val kpg = KeyPairGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_EC,
                    ANDROID_KEYSTORE
                )
                kpg.initialize(spec)
                kpg.generateKeyPair()
                strongBoxUsed = true
                true
            } catch (_: Exception) {
                // StrongBox not available on this device
                false
            }
        }

        private fun generateInTee(): Boolean {
            return try {
                val spec = KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
                )
                    .setAlgorithmParameterSpec(java.security.spec.ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .build()

                val kpg = KeyPairGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_EC,
                    ANDROID_KEYSTORE
                )
                kpg.initialize(spec)
                kpg.generateKeyPair()
                strongBoxUsed = false
                true
            } catch (_: Exception) {
                false
            }
        }

        /**
         * Extract the uncompressed public key point (65 bytes: 0x04 || X || Y).
         * The Android KeyStore returns an X.509 SubjectPublicKeyInfo; we strip
         * the ASN.1 header to get the raw point.
         */
        private fun getPublicKeyBytes(): ByteArray {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)

            val entry = keyStore.getEntry(KEY_ALIAS, null) as KeyStore.PrivateKeyEntry
            val encoded = entry.certificate.publicKey.encoded

            // X.509 SPKI for P-256: 26-byte header + 65-byte uncompressed point
            if (encoded.size == 91) {
                return encoded.copyOfRange(26, 91)
            }

            // Fallback: return full encoded key
            return encoded
        }
    }
}
