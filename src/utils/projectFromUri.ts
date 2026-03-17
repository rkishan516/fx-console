import { FxProject } from '../types';

/**
 * Resolves a file system path to the FxProject that owns it,
 * by finding the project whose path is a prefix of the given fsPath.
 * Returns the most specific (longest matching path) project.
 */
export function projectFromUri(fsPath: string, projects: FxProject[]): FxProject | undefined {
  const normalized = fsPath.replace(/\\/g, '/');
  let best: FxProject | undefined;

  for (const project of projects) {
    const projectPath = project.path.replace(/\\/g, '/');
    if (normalized === projectPath || normalized.startsWith(projectPath + '/')) {
      if (!best || projectPath.length > best.path.length) {
        best = project;
      }
    }
  }

  return best;
}
