const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-or-v1-[A-Za-z0-9._-]+/g,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\b(?:api[_-]?key|token|secret|password|passwd|pwd|authorization)\b\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi,
];

export function redactText(input: string): string {
  let output = input;

  output = output.replace(
    /\b(api[_-]?key|token|secret|password|passwd|pwd|authorization)\b(\s*[:=]\s*)["']?[^"'\s]+["']?/gi,
    '$1$2[REDACTED]',
  );

  for (const pattern of SECRET_PATTERNS.slice(0, -1)) {
    output = output.replace(pattern, '[REDACTED]');
  }

  output = output.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, 'Bearer [REDACTED]');

  return output;
}

export function containsSuspiciousSecret(input: string): boolean {
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(input);
  });
}

export function maskSecret(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }

  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }

  return `${value.slice(0, 4)}${'*'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
}
