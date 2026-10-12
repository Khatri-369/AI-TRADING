/**
 * Secret-safe production logger.
 * Automatically masks known tokens, bearer headers, API keys, and sensitive environment patterns.
 */

const SECRET_PATTERNS = [
  /Bearer\s+([a-zA-Z0-9._~+/-]+=*)/gi,
  /(key|token|secret|password|authorization)=([a-zA-Z0-9._~+/-]+)/gi,
  /("?(?:api_?key|token|secret|password)"?\s*:\s*"*)([^"\s]+)("?)/gi,
];

export function scrubSecrets(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, prefix, secret, suffix) => {
      if (typeof suffix === 'string') {
        return `${prefix}[REDACTED]${suffix}`;
      }
      if (typeof secret === 'string') {
        return `${prefix}=[REDACTED]`;
      }
      return 'Bearer [REDACTED]';
    });
  }
  return output;
}

export const logger = {
  info(message: string, meta?: unknown) {
    const time = new Date().toISOString();
    const metaStr = meta ? ` ${scrubSecrets(typeof meta === 'string' ? meta : JSON.stringify(meta))}` : '';
    console.log(`[${time}] [INFO] ${scrubSecrets(message)}${metaStr}`);
  },
  warn(message: string, meta?: unknown) {
    const time = new Date().toISOString();
    const metaStr = meta ? ` ${scrubSecrets(typeof meta === 'string' ? meta : JSON.stringify(meta))}` : '';
    console.warn(`[${time}] [WARN] ${scrubSecrets(message)}${metaStr}`);
  },
  error(message: string, error?: unknown) {
    const time = new Date().toISOString();
    let errStr = '';
    if (error instanceof Error) {
      errStr = ` | Error: ${scrubSecrets(error.message)}`;
    } else if (error) {
      errStr = ` | ${scrubSecrets(typeof error === 'string' ? error : JSON.stringify(error))}`;
    }
    console.error(`[${time}] [ERROR] ${scrubSecrets(message)}${errStr}`);
  },
};
