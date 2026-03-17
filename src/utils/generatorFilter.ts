import { FxGenerator } from '../types';

/**
 * Filters generators by allowlist and blocklist glob patterns.
 * - If allowlist is non-empty, only matching generators are included.
 * - Blocklist removes matching generators from the result.
 * - Patterns support `*` (any chars) and `?` (single char) wildcards.
 */
export function filterGenerators(
  generators: FxGenerator[],
  allowlist: string[],
  blocklist: string[]
): FxGenerator[] {
  let filtered = generators;

  if (allowlist.length > 0) {
    filtered = filtered.filter(g => allowlist.some(p => globMatch(p, g.name)));
  }

  if (blocklist.length > 0) {
    filtered = filtered.filter(g => !blocklist.some(p => globMatch(p, g.name)));
  }

  return filtered;
}

/**
 * Simple glob matching: `*` matches any sequence of chars, `?` matches one char.
 */
function globMatch(pattern: string, str: string): boolean {
  const regex = new RegExp(
    '^' +
    pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.') +
    '$'
  );
  return regex.test(str);
}
