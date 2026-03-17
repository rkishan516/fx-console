import { FxProject, FxGraphData, FxRichGraphData } from '../types';

/**
 * Merges fx graph --format json (nodes as strings, edges with from/to)
 * with fx show projects --json (full project details)
 * into rich format for the webview (nodes as objects, edges with source/target).
 */
export function buildRichGraphData(
  graphData: FxGraphData,
  projects: FxProject[]
): FxRichGraphData {
  const projectMap = new Map(projects.map(p => [p.name, p]));

  const nodes = graphData.nodes.map(name => {
    const project = projectMap.get(name);
    return {
      id: name,
      type: project?.type ?? 'dart_package',
      tags: project?.tags ?? [],
      path: project?.path ?? '',
    };
  });

  const edges = graphData.edges.map(e => ({
    source: e.from,
    target: e.to,
  }));

  return { nodes, edges };
}

export type ProjectViewingStyle = 'list' | 'tree' | 'automatic';

export type ProjectLayout =
  | { grouped: true; groups: Map<string, FxProject[]> }
  | { grouped: false; items: FxProject[] };

/**
 * Returns project layout based on the viewing style setting.
 * - 'list': always flat
 * - 'tree': always grouped by folder
 * - 'automatic': grouped only when there are multiple distinct folders
 */
export function getProjectLayout(projects: FxProject[], style: ProjectViewingStyle): ProjectLayout {
  if (style === 'list') {
    return { grouped: false, items: projects };
  }
  const groups = groupProjectsByFolder(projects);
  if (style === 'tree' || groups.size > 1) {
    return { grouped: true, groups };
  }
  return { grouped: false, items: projects };
}

/**
 * Computes the transitive dependencies of a project via BFS.
 * Returns a Set including the project itself and all reachable downstream nodes.
 */
export function getTransitiveDeps(
  projectId: string,
  edges: { source: string; target: string }[]
): Set<string> {
  const result = new Set<string>([projectId]);
  const queue = [projectId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.source === current && !result.has(edge.target)) {
        result.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return result;
}

/**
 * Groups projects by their parent folder name.
 */
export function groupProjectsByFolder(
  projects: FxProject[]
): Map<string, FxProject[]> {
  const groups = new Map<string, FxProject[]>();
  for (const project of projects) {
    // Get last two path segments: e.g. /ws/packages/core -> "packages"
    const parts = project.path.replace(/\\/g, '/').split('/');
    const folder = parts.length >= 2 ? parts[parts.length - 2] : 'root';
    if (!groups.has(folder)) groups.set(folder, []);
    groups.get(folder)!.push(project);
  }
  return groups;
}
