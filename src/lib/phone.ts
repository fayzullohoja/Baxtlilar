/**
 * Normalize a user-typed Uzbek phone into E.164 (+998XXXXXXXXX).
 *
 * Accepts:
 *   - "+998 90 123 45 67"   → "+998901234567"
 *   - "998901234567"        → "+998901234567"
 *   - "8901234567"          → "+998901234567"  (drops local trunk prefix 8)
 *   - "901234567"           → "+998901234567"  (9-digit short form)
 *   - "+99890 1234567"      → "+998901234567"
 *
 * Returns null if the input cannot produce a valid 13-char +998 format.
 */
export function normalizeUzPhone(raw: string): string | null {
  if (!raw) return null;
  // Drop everything except digits and leading +
  const cleaned = raw.replace(/[^\d+]/g, "");
  let body = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  // Strip leading "8" trunk-call prefix if it's followed by 9 digits and
  // doesn't look like a country code prefix.
  if (body.length === 10 && body.startsWith("8")) {
    body = body.slice(1);
  }

  // Add country code if missing
  if (body.length === 9) {
    body = "998" + body;
  }

  // Final check: must be exactly 998 + 9 digits
  if (!/^998\d{9}$/.test(body)) return null;

  // First digit after 998 must be a valid Uzbek mobile operator code (9X)
  // Most UZ mobile operators start with 9 or 33 or 88. We accept anything 9 numeric.
  return `+${body}`;
}
