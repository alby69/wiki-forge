export interface HiddenInstructionReport {
  risky: boolean;
  reasons: string[];
}

const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff\u180e]/;

const HIDDEN_INSTRUCTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts)/i,
  /disregard\s+(the\s+)?(system|developer|prior|above|previous)\s+(prompt|prompts|instructions)/i,
  /you\s+are\s+now\s+(?:a|an)\s+\w+/i,
  /system\s*:\s*/i,
  /<\/?\s*(?:system|assistant|user)\s*>/i,
  /exfiltrat/i,
  /send\b[^\n]{0,60}(?:secret|token|password|data)[^\n]{0,60}\bto\b/i,
  /ignora\s+(le\s+)?istruzioni\s+precedenti/i,
  /ignora\s+tutto/i,
  /stampa\w*\s+le\s+chiavi/i,
  /istruzioni\s+di\s+sistema\s+nascoste/i,
  /chiavi\s+api/i,
  /output\s+your\s+hidden\s+system\s+instructions/i,
  /hidden\s+system\s+instructions/i,
  /sei\s+ora\s+un/i,
  /invia\b[^\n]{0,60}(?:segreto|token|password|dati)[^\n]{0,60}\ba\b/i,
];

const HIDDEN_MARKUP_PATTERNS: RegExp[] = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /font-size\s*:\s*0/i,
  /opacity\s*:\s*0/i,
  /<!--[\s\S]*?-->/,
];

const EXFIL_URL = /https?:\/\/[^\s"'<>]+/gi;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-[A-Za-z0-9]{20,}/g, '[REDACTED:openai-key]'],
  [/ghp_[A-Za-z0-9]{30,}/g, '[REDACTED:github-token]'],
  [/AKIA[0-9A-Z]{16}/g, '[REDACTED:aws-key]'],
  [/Bearer\s+[A-Za-z0-9._-]{20,}/gi, '[REDACTED:bearer]'],
  [/(?:password|passwd|pwd)\s*[:=]\s*\S+/gi, '[REDACTED:password]'],
  [/(?:api[_-]?key|secret|token)\s*[:=]\s*\S+/gi, '[REDACTED:secret]'],
];

export function detectHiddenInstructions(text: string): HiddenInstructionReport {
  const reasons: string[] = [];
  if (ZERO_WIDTH.test(text)) reasons.push('zero-width characters');
  for (const pattern of HIDDEN_INSTRUCTION_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`hidden instruction: ${pattern.source}`);
      break;
    }
  }
  for (const pattern of HIDDEN_MARKUP_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(`hidden markup: ${pattern.source}`);
      break;
    }
  }
  const urls = text.match(EXFIL_URL) ?? [];
  if (urls.some((url) => /169\.254\.169\.254|localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url))) {
    reasons.push('suspicious exfiltration URL');
  }
  return { risky: reasons.length > 0, reasons };
}

export function redactSecrets(text: string): string {
  let result = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function wrapUntrusted(content: string): string {
  return `<untrusted-content>\n${content}\n</untrusted-content>`;
}
