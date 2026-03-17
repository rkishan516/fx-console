import * as fs from 'fs';
import * as path from 'path';

/**
 * Walks up the directory tree from startDir looking for fx.yaml.
 * Mirrors the behavior of fx CLI's FileUtils.findWorkspaceRoot().
 * Returns the directory containing fx.yaml, or undefined if not found.
 */
export function findWorkspaceRoot(startDir: string): string | undefined {
  let current = startDir;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(current, 'fx.yaml');
    if (fs.existsSync(candidate)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return undefined;
    }
    current = parent;
  }
}
