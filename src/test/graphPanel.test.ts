import * as assert from 'assert';
import { buildRichGraphData, groupProjectsByFolder, getTransitiveDeps } from '../utils/graphDataBuilder';
import { FxProject } from '../types';

const makeProject = (name: string, path: string, type = 'dart_package', tags: string[] = []): FxProject => ({
  name,
  type,
  path,
  tags,
  dependencies: [],
  dependents: [],
  targets: {},
});

suite('buildRichGraphData', () => {
  test('merges graph nodes with project metadata', () => {
    const graphData = {
      nodes: ['app', 'core', 'utils'],
      edges: [{ from: 'app', to: 'core' }, { from: 'app', to: 'utils' }],
    };
    const projects = [
      makeProject('app', '/ws/apps/app', 'flutter_app', ['scope:app']),
      makeProject('core', '/ws/packages/core'),
      makeProject('utils', '/ws/packages/utils'),
    ];

    const rich = buildRichGraphData(graphData, projects);

    assert.strictEqual(rich.nodes.length, 3);
    const appNode = rich.nodes.find(n => n.id === 'app')!;
    assert.strictEqual(appNode.type, 'flutter_app');
    assert.deepStrictEqual(appNode.tags, ['scope:app']);
    assert.strictEqual(appNode.path, '/ws/apps/app');
  });

  test('converts from/to edges to source/target format', () => {
    const graphData = {
      nodes: ['a', 'b'],
      edges: [{ from: 'a', to: 'b' }],
    };
    const rich = buildRichGraphData(graphData, [
      makeProject('a', '/ws/packages/a'),
      makeProject('b', '/ws/packages/b'),
    ]);

    assert.strictEqual(rich.edges.length, 1);
    assert.strictEqual(rich.edges[0].source, 'a');
    assert.strictEqual(rich.edges[0].target, 'b');
  });

  test('falls back to dart_package type for unknown projects', () => {
    const graphData = {
      nodes: ['unknown'],
      edges: [],
    };
    const rich = buildRichGraphData(graphData, []);

    assert.strictEqual(rich.nodes[0].type, 'dart_package');
    assert.deepStrictEqual(rich.nodes[0].tags, []);
  });

  test('handles empty graph', () => {
    const rich = buildRichGraphData({ nodes: [], edges: [] }, []);
    assert.strictEqual(rich.nodes.length, 0);
    assert.strictEqual(rich.edges.length, 0);
  });
});

suite('getTransitiveDeps', () => {
  test('returns just the project when it has no deps', () => {
    const edges = [{ source: 'a', target: 'b' }];
    const result = getTransitiveDeps('b', edges);
    assert.ok(result.has('b'));
    assert.strictEqual(result.size, 1);
  });

  test('includes direct dependencies', () => {
    const edges = [{ source: 'app', target: 'core' }];
    const result = getTransitiveDeps('app', edges);
    assert.ok(result.has('app'));
    assert.ok(result.has('core'));
  });

  test('includes transitive dependencies', () => {
    const edges = [
      { source: 'app', target: 'core' },
      { source: 'core', target: 'utils' },
    ];
    const result = getTransitiveDeps('app', edges);
    assert.ok(result.has('app'));
    assert.ok(result.has('core'));
    assert.ok(result.has('utils'));
  });

  test('does not include projects that do not depend on target', () => {
    const edges = [
      { source: 'app', target: 'core' },
      { source: 'other', target: 'utils' },
    ];
    const result = getTransitiveDeps('app', edges);
    assert.ok(!result.has('other'));
    assert.ok(!result.has('utils'));
  });

  test('handles cycles gracefully', () => {
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }, // cycle
    ];
    const result = getTransitiveDeps('a', edges);
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.strictEqual(result.size, 2);
  });
});

suite('groupProjectsByFolder', () => {
  test('groups projects by parent folder name', () => {
    const projects = [
      makeProject('app1', '/ws/apps/app1'),
      makeProject('app2', '/ws/apps/app2'),
      makeProject('core', '/ws/packages/core'),
    ];

    const groups = groupProjectsByFolder(projects);

    assert.strictEqual(groups.size, 2);
    assert.strictEqual(groups.get('apps')?.length, 2);
    assert.strictEqual(groups.get('packages')?.length, 1);
  });

  test('handles single project', () => {
    const groups = groupProjectsByFolder([makeProject('core', '/ws/packages/core')]);
    assert.strictEqual(groups.size, 1);
  });
});
