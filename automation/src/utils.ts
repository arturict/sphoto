// =============================================================================
// Utility Functions
// =============================================================================
// Common utilities used across the automation server.
// Pure functions that are easy to test.

/**
 * Generate a random alphanumeric password
 * @param length - Password length (default: 12)
 */
export function generatePassword(length = 12): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Generate a visible ID from an email address
 * @param email - User email address
 * @returns A URL-friendly identifier like "john-abc1"
 */
export function generateVisibleId(email: string): string {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Convert gigabytes to bytes
 * @param gb - Gigabytes
 * @returns Bytes as number
 */
export function gbToBytes(gb: number): number {
  return Number(BigInt(gb) * BigInt(1024) * BigInt(1024) * BigInt(1024));
}

/**
 * Convert bytes to gigabytes (rounded to 2 decimal places)
 * @param bytes - Number of bytes
 * @returns Gigabytes
 */
export function bytesToGb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024 * 1024) * 100) / 100;
}

/**
 * Generate a cryptographically random token
 * @param length - Token length (default: 32)
 */
export function generateToken(length = 32): string {
  return Array.from({ length }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
}

/**
 * Generate a UUID-based portal token
 * More secure than random strings for authentication
 */
export function generatePortalToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
}

/**
 * Calculate percentage (safely handles division by zero)
 * @param used - Used amount
 * @param total - Total amount
 * @returns Percentage as integer
 */
export function calculatePercentage(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

/**
 * Format a date for Swiss locale (dd.MM.yyyy)
 * @param date - Date string or Date object
 */
export function formatDateCH(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date with weekday for Swiss locale
 * @param date - Date string or Date object
 */
export function formatDateLongCH(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-CH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Add days to a date
 * @param date - Starting date
 * @param days - Number of days to add
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if a date is in the past
 * @param date - Date to check
 */
export function isDatePast(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d < new Date();
}

/**
 * Validate email format
 * @param email - Email address to validate
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize email for comparison (lowercase, trim)
 * @param email - Email to sanitize
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Create an abort signal with timeout
 * @param ms - Timeout in milliseconds
 */
export function createTimeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}
