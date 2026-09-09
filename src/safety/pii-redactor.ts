/**
 * Financial PII and Secret Redactor
 * Strictly enforces masking of SSNs, card numbers, passwords, and tokens
 * to prevent leaking sensitive financial data into logs, artifacts, or traces.
 */

const SSN_REGEX = /\b(?:\d{3}[-\s]\d{2}[-\s]\d{4}|\d{9})\b/g;
const CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
// Standard JWT tokens begin with 'eyJ'
const JWT_TOKEN_REGEX = /\beyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\b/g;
const BEARER_TOKEN_REGEX = /\bBearer\s+[A-Za-z0-9\-_=.]+\b/g;
const SECRET_KEY_REGEX = /\b(?:sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{35}|[a-f0-9]{32,64})\b/g;

export class PiiRedactor {
  /**
   * Redacts sensitive strings from a given text.
   */
  public static redactText(text: string): string {
    if (!text || typeof text !== 'string') return text;

    let redacted = text;

    // Mask SSN: keep last 4 digits
    redacted = redacted.replace(SSN_REGEX, (match) => {
      const clean = match.replace(/[-\s]/g, '');
      const last4 = clean.slice(-4);
      return `***-**-${last4}`;
    });

    // Mask Card Numbers: keep last 4 digits
    redacted = redacted.replace(CARD_REGEX, (match) => {
      const clean = match.replace(/[-\s]/g, '');
      const last4 = clean.slice(-4);
      return `****-****-****-${last4}`;
    });

    // Mask JWT Tokens
    redacted = redacted.replace(JWT_TOKEN_REGEX, '[REDACTED_JWT_TOKEN]');

    // Mask Bearer Tokens
    redacted = redacted.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]');

    // Mask Secret Keys
    redacted = redacted.replace(SECRET_KEY_REGEX, '[REDACTED_SECRET_KEY]');

    return redacted;
  }

  /**
   * Deeply redacts sensitive keys and string patterns from an object or array.
   */
  public static redactObject<T>(data: T): T {
    if (data === null || data === undefined) return data;

    if (typeof data === 'string') {
      return this.redactText(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactObject(item)) as unknown as T;
    }

    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      const sensitiveKeys = ['password', 'secret', 'token', 'apikey', 'api_key', 'authorization', 'pin', 'key'];

      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          result[key] = '[REDACTED_SENSITIVE_KEY]';
        } else {
          result[key] = this.redactObject(value);
        }
      }
      return result as T;
    }

    return data;
  }
}
