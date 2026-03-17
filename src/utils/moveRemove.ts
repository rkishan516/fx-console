import * as path from 'path';

/**
 * Builds the full destination path for a project move.
 * If destination is absolute, returns it as-is.
 * If relative, joins it with the workspace root.
 */
export function buildDestinationPath(workspaceRoot: string, destination: string): string {
  const cleaned = destination.replace(/\/+$/, '');
  if (path.isAbsolute(cleaned)) {
    return cleaned;
  }
  return path.join(workspaceRoot.replace(/\/+$/, ''), cleaned);
}

/**
 * Validates a destination path input.
 * Returns an error message string, or null if valid.
 */
export function validateDestination(input: string): string | null {
  if (!input || !input.trim()) {
    return 'Destination path is required';
  }
  if (input.includes('..')) {
    return 'Destination must not contain ".." (parent directory traversal)';
  }
  return null;
}
