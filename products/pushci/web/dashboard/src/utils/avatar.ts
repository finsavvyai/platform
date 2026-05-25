export function getAvatarUrl(avatarUrl: string | undefined, login: string): string {
  if (avatarUrl) return avatarUrl;
  // Generate Gravatar URL from login (might be email)
  // Use SubtleCrypto is async, so use a simple hash instead
  // Fallback to UI Avatars service which generates letter avatars
  const encoded = encodeURIComponent(login);
  return `https://ui-avatars.com/api/?name=${encoded}&background=3f3f46&color=e4e4e7&size=128`;
}
