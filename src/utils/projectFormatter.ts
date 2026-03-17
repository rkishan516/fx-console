import { FxProject } from '../types';

export interface ProjectDetailSection {
  name: string;
  type: string;
  path: string;
  tags: string[];
  targets: { name: string; executor: string; dependsOn: string[]; inputs: string[] }[];
  dependencies: string[];
  dependents: string[];
}

export function formatProjectForDisplay(project: FxProject): ProjectDetailSection {
  const targets = Object.entries(project.targets).map(([name, t]) => ({
    name,
    executor: t.executor,
    dependsOn: t.dependsOn ?? [],
    inputs: t.inputs ?? [],
  }));

  return {
    name: project.name,
    type: project.type,
    path: project.path,
    tags: project.tags,
    targets,
    dependencies: project.dependencies,
    dependents: project.dependents,
  };
}
