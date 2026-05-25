// Validation schemas for the unified authentication system

export const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/
};

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const validationMessages = {
  emailRequired: 'Email address is required',
  emailInvalid: 'Please enter a valid email address',
  passwordRequired: 'Password is required',
  passwordMinLength: `Password must be at least ${passwordRequirements.minLength} characters long`,
  passwordUppercase: 'Password must contain at least one uppercase letter',
  passwordLowercase: 'Password must contain at least one lowercase letter',
  passwordNumber: 'Password must contain at least one number',
  passwordSpecial: 'Password must contain at least one special character',
  nameRequired: 'Name is required',
  nameMinLength: 'Name must be at least 2 characters long',
  tierRequired: 'Subscription tier is required',
  mfaTokenRequired: 'MFA token is required',
  mfaTokenInvalid: 'Invalid MFA token',
  mfaTokenLength: 'MFA token must be 6 digits'
};

export const validateEmail = (email: string): string | null => {
  if (!email) return validationMessages.emailRequired;
  if (!emailRegex.test(email)) return validationMessages.emailInvalid;
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return validationMessages.passwordRequired;

  const errors: string[] = [];

  if (password.length < passwordRequirements.minLength) {
    errors.push(validationMessages.passwordMinLength);
  }

  if (passwordRequirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push(validationMessages.passwordUppercase);
  }

  if (passwordRequirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push(validationMessages.passwordLowercase);
  }

  if (passwordRequirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push(validationMessages.passwordNumber);
  }

  if (passwordRequirements.requireSpecialChars && !passwordRequirements.specialChars.test(password)) {
    errors.push(validationMessages.passwordSpecial);
  }

  return errors.length > 0 ? errors.join(', ') : null;
};

export const validateName = (name: string): string | null => {
  if (!name || name.trim().length === 0) return validationMessages.nameRequired;
  if (name.trim().length < 2) return validationMessages.nameMinLength;
  return null;
};

export const validateTier = (tier: string): string | null => {
  const validTiers = ['starter', 'professional', 'enterprise'];
  if (!tier) return validationMessages.tierRequired;
  if (!validTiers.includes(tier)) return 'Invalid subscription tier';
  return null;
};

export const validateMFA = (token: string): string | null => {
  if (!token) return validationMessages.mfaTokenRequired;
  if (!/^\d{6}$/.test(token)) return validationMessages.mfaTokenLength;
  return null;
};

export const validateMFABackupCode = (code: string): string | null => {
  if (!code) return 'Backup code is required';
  if (!/^[A-Z0-9]{8}$/.test(code)) return 'Backup code must be 8 characters';
  return null;
};

export interface ValidationError {
  field: string;
  message: string;
}

export const validateRegistration = (
  email: string,
  password: string,
  name: string,
  tier?: string
): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  const passwordError = validatePassword(password);
  if (passwordError) errors.push({ field: 'password', message: passwordError });

  const nameError = validateName(name);
  if (nameError) errors.push({ field: 'name', message: nameError });

  if (tier) {
    const tierError = validateTier(tier);
    if (tierError) errors.push({ field: 'tier', message: tierError });
  }

  return errors;
};

export const validateLogin = (email: string, password: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(email);
  if (emailError) errors.push({ field: 'email', message: emailError });

  if (!password) {
    errors.push({ field: 'password', message: validationMessages.passwordRequired });
  }

  return errors;
};

export const validateOrganizationName = (name: string): string | null => {
  if (!name || name.trim().length === 0) return 'Organization name is required';
  if (name.trim().length < 2) return 'Organization name must be at least 2 characters long';
  if (name.trim().length > 100) return 'Organization name must be less than 100 characters';
  if (!/^[a-zA-Z0-9\s\-_.]+$/.test(name)) return 'Organization name contains invalid characters';
  return null;
};

export const validateOrganizationSlug = (slug: string): string | null => {
  if (!slug || slug.trim().length === 0) return 'Organization slug is required';
  if (slug.trim().length < 2) return 'Organization slug must be at least 2 characters long';
  if (slug.trim().length > 50) return 'Organization slug must be less than 50 characters';
  if (!/^[a-z0-9\-_]+$/.test(slug)) return 'Organization slug must contain only lowercase letters, numbers, hyphens, and underscores';
  return null;
};

export const validateAPIKey = (name: string): string | null => {
  if (!name || name.trim().length === 0) return 'API key name is required';
  if (name.trim().length < 1) return 'API key name must be at least 1 character long';
  if (name.trim().length > 100) return 'API key name must be less than 100 characters';
  return null;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const isStrongPassword = (password: string): boolean => {
  const errors = validatePassword(password);
  return errors === null;
};

export const generateSecureRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getTimeAgo = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return formatDate(d);
};