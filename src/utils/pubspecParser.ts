import * as yaml from 'yaml';

export interface ParsedPubspec {
  name: string;
  version?: string;
  description?: string;
  fx?: {
    tags?: string[];
    targets?: Record<string, unknown>;
  };
}

export interface FxTargetRef {
  name: string;
  line: number;
}

/**
 * Parses pubspec.yaml content and returns structured data.
 */
export function parsePubspec(content: string): ParsedPubspec {
  const doc = yaml.parse(content) as ParsedPubspec;
  return doc ?? { name: '' };
}

/**
 * Extracts fx target definitions and their line numbers from pubspec.yaml content.
 * Looks for targets under `fx: > targets:`.
 */
export function extractFxTargets(content: string): FxTargetRef[] {
  const parsed = parsePubspec(content);
  if (!parsed?.fx?.targets) {
    return [];
  }

  const targetNames = Object.keys(parsed.fx.targets);
  if (targetNames.length === 0) {
    return [];
  }

  // Find line numbers by scanning the raw content
  const lines = content.split('\n');
  const results: FxTargetRef[] = [];

  for (const targetName of targetNames) {
    // Look for the target key followed by colon (possibly with spaces)
    // Under the targets: section — match indented target names
    const targetPattern = new RegExp(`^\\s{4}${escapeRegex(targetName)}\\s*:`);
    for (let i = 0; i < lines.length; i++) {
      if (targetPattern.test(lines[i])) {
        results.push({ name: targetName, line: i });
        break;
      }
    }
  }

  // Sort by line number
  results.sort((a, b) => a.line - b.line);
  return results;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
