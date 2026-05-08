// In-memory cookie jar that mimics Next.js `cookies()` for vitest.
// Reset between tests via clearTestCookies() if needed.

interface CookieEntry {
  name: string;
  value: string;
}

const jar = new Map<string, string>();

export function clearTestCookies() {
  jar.clear();
}

export function getTestCookie(name: string): string | undefined {
  return jar.get(name);
}

export async function cookies() {
  return {
    get(name: string): CookieEntry | undefined {
      const v = jar.get(name);
      return v == null ? undefined : { name, value: v };
    },
    set(name: string, value: string) {
      jar.set(name, value);
    },
    delete(name: string) {
      jar.delete(name);
    },
  };
}

export async function headers() {
  return new Headers();
}
