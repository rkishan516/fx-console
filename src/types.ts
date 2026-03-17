/** A target defined for an fx project */
export interface FxTarget {
  executor: string;
  dependsOn?: string[];
  inputs?: string[];
}

/** An fx workspace project (from fx show projects --json) */
export interface FxProject {
  name: string;
  type: string; // 'dart_package' | 'flutter_package' | 'flutter_app' | 'dart_cli'
  path: string;
  tags: string[];
  dependencies: string[];
  dependents: string[];
  targets: Record<string, FxTarget>;
}

/** Graph data from fx graph --format json */
export interface FxGraphData {
  nodes: string[];
  edges: { from: string; to: string }[];
}

/** Richer graph data merged from fx graph + fx show projects */
export interface FxRichGraphData {
  nodes: FxGraphNode[];
  edges: { source: string; target: string }[];
}

export interface FxGraphNode {
  id: string;
  type: string;
  tags: string[];
  path: string;
}

/** A generator from fx generate --list */
export interface FxGenerator {
  name: string;
  description: string;
}

/** Options for running an fx target */
export interface RunOptions {
  verbose?: boolean;
  skipCache?: boolean;
  configuration?: string;
  excludeTaskDependencies?: boolean;
  extraArgs?: string;
}

/** A migration from fx migrate --list --json */
export interface FxMigration {
  pluginName: string;
  fromVersion: string;
  toVersion: string;
}

/** A migration step with proposed changes from dry-run */
export interface FxMigrationStep {
  pluginName: string;
  fromVersion: string;
  toVersion: string;
  changes: FxMigrationChange[];
}

/** A single change within a migration step */
export interface FxMigrationChange {
  type: string;
  filePath: string;
  description: string;
}

/** A task history entry */
export interface TaskHistoryEntry {
  id: string;
  project: string;
  target: string;
  command: string;
  status: 'running' | 'success' | 'failure' | 'cached';
  startTime: number;
  duration?: number;
  exitCode?: number;
}
