import * as assert from 'assert';
import { groupProjectsByFolder, getProjectLayout } from '../utils/graphDataBuilder';
import { FxCli } from '../fxCli';
import { FxProject } from '../types';

type ExecFn = (
  file: string,
  args: string[],
  opts: unknown,
  cb: (e: Error | null, out: string, err: string) => void
) => void;

const makeProject = (name: string, path: string): FxProject => ({
  name,
  type: 'dart_package',
  path,
  tags: [],
  dependencies: [],
  dependents: [],
  targets: {},
});

function makeCliWith(projects: FxProject[]): FxCli {
  const execFn: ExecFn = (_file, _args, _opts, cb) => {
    cb(null, JSON.stringify(projects), '');
  };
  return new FxCli('fx', execFn as never);
}

suite('WorkspaceExplorer (pure logic)', () => {
  test('groupProjectsByFolder groups by parent directory', () => {
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

  test('empty workspace returns empty project list', async () => {
    const cli = makeCliWith([]);
    const projects = await cli.listProjects();
    assert.strictEqual(projects.length, 0);
  });

  test('projects with targets: target names available', async () => {
    const projectWithTargets: FxProject = {
      name: 'my_app',
      type: 'flutter_app',
      path: '/ws/apps/my_app',
      tags: [],
      dependencies: [],
      dependents: [],
      targets: {
        build: { executor: 'flutter build' },
        test: { executor: 'flutter test' },
      },
    };
    const cli = makeCliWith([projectWithTargets]);
    const projects = await cli.listProjects();
    const targetNames = Object.keys(projects[0].targets);
    assert.ok(targetNames.includes('build'));
    assert.ok(targetNames.includes('test'));
  });

  test('getProjectLayout list: returns flat array regardless of folder count', () => {
    const projects = [
      makeProject('app1', '/ws/apps/app1'),
      makeProject('core', '/ws/packages/core'),
      makeProject('utils', '/ws/packages/utils'),
    ];
    const result = getProjectLayout(projects, 'list');
    assert.ok(!result.grouped, 'list mode should not group');
    assert.strictEqual(result.items.length, 3);
  });

  test('getProjectLayout tree: returns grouped map always', () => {
    const projects = [
      makeProject('app1', '/ws/apps/app1'),
      makeProject('core', '/ws/packages/core'),
    ];
    const result = getProjectLayout(projects, 'tree');
    assert.ok(result.grouped, 'tree mode should always group');
    assert.ok(result.groups.has('apps'));
    assert.ok(result.groups.has('packages'));
  });

  test('getProjectLayout automatic: groups when multiple folders', () => {
    const projects = [
      makeProject('app1', '/ws/apps/app1'),
      makeProject('core', '/ws/packages/core'),
    ];
    const result = getProjectLayout(projects, 'automatic');
    assert.ok(result.grouped, 'automatic with 2 folders should group');
  });

  test('getProjectLayout automatic: flat when single folder', () => {
    const projects = [
      makeProject('app1', '/ws/apps/app1'),
      makeProject('app2', '/ws/apps/app2'),
    ];
    const result = getProjectLayout(projects, 'automatic');
    assert.ok(!result.grouped, 'automatic with 1 folder should be flat');
    assert.strictEqual(result.items.length, 2);
  });

  test('projects data includes dependents and tags', async () => {
    const project: FxProject = {
      name: 'core',
      type: 'dart_package',
      path: '/ws/packages/core',
      tags: ['scope:shared'],
      dependencies: [],
      dependents: ['app1', 'app2'],
      targets: {},
    };
    const cli = makeCliWith([project]);
    const projects = await cli.listProjects();

    assert.deepStrictEqual(projects[0].tags, ['scope:shared']);
    assert.deepStrictEqual(projects[0].dependents, ['app1', 'app2']);
  });
});
