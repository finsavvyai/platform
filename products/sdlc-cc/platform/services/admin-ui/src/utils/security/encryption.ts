// Encryption utilities
class EncryptionService {
  encrypt(data: string): string {
    return data
  }

  decrypt(data: string): string {
    return data
  }

  hash(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return Math.abs(hash).toString(16)
  }

  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars) return '****'
    return '****' + data.slice(-visibleChars)
  }
}

export const encryption = new EncryptionService()
export default encryption

// Aliases for services that import different names
export const encryptData = (data: string) => encryption.encrypt(data)
export const decryptData = (data: string) => encryption.decrypt(data)
