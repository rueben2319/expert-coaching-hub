const SECRET_KEY_PATTERN = /(apikey|api[_-]?key|token|access[_-]?token|refresh[_-]?token|authorization|jwt|secret|password|session)/i;

const MASK = "[REDACTED]";

const maybeRedactString = (value: string): string => {
  let sanitized = value;

  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${MASK}`);
  sanitized = sanitized.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, MASK);
  sanitized = sanitized.replace(/(apikey\s*[:=]\s*)(["']?)[A-Za-z0-9\-._~+/=]{8,}\2/gi, `$1${MASK}`);
  sanitized = sanitized.replace(/(access[_-]?token\s*[:=]\s*)(["']?)[A-Za-z0-9\-._~+/=]{8,}\2/gi, `$1${MASK}`);
  sanitized = sanitized.replace(/(refresh[_-]?token\s*[:=]\s*)(["']?)[A-Za-z0-9\-._~+/=]{8,}\2/gi, `$1${MASK}`);

  return sanitized;
};

const redactObject = (value: unknown, seen: WeakSet<object>): unknown => {
  if (value == null) return value;

  if (typeof value === "string") {
    return maybeRedactString(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: maybeRedactString(value.message),
      stack: value.stack ? maybeRedactString(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry, seen));
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value as object)) {
    return "[Circular]";
  }

  seen.add(value as object);

  const inputRecord = value as Record<string, unknown>;
  const outputRecord: Record<string, unknown> = {};

  Object.entries(inputRecord).forEach(([key, entryValue]) => {
    if (SECRET_KEY_PATTERN.test(key)) {
      outputRecord[key] = MASK;
      return;
    }

    outputRecord[key] = redactObject(entryValue, seen);
  });

  seen.delete(value as object);
  return outputRecord;
};

export const redactSensitiveData = <T>(value: T): T => {
  return redactObject(value, new WeakSet<object>()) as T;
};
