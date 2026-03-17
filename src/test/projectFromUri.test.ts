import * as assert from 'assert';
import { projectFromUri } from '../utils/projectFromUri';
import { FxProject } from '../types';

const makeProject = (name: string, projectPath: string): FxProject => ({
  name,
  type: 'dart_package',
  path: projectPath,
  tags: [],
  dependencies: [],
  dependents: [],
  targets: {},
});

suite('projectFromUri', () => {
  const projects: FxProject[] = [
    makeProject('my_app', '/ws/apps/my_app'),
    makeProject('core', '/ws/packages/core'),
    makeProject('utils', '/ws/packages/utils'),
  ];

  test('returns project when uri matches project path exactly', () => {
    const result = projectFromUri('/ws/apps/my_app', projects);
    assert.ok(result, 'expected a project to be found');
    assert.strictEqual(result!.name, 'my_app');
  });

  test('returns project when uri is a file inside the project directory', () => {
    const result = projectFromUri('/ws/packages/core/pubspec.yaml', projects);
    assert.ok(result, 'expected a project to be found');
    assert.strictEqual(result!.name, 'core');
  });

  test('returns project when uri is a nested file inside the project', () => {
    const result = projectFromUri('/ws/packages/utils/lib/src/utils.dart', projects);
    assert.ok(result, 'expected a project to be found');
    assert.strictEqual(result!.name, 'utils');
  });

  test('returns undefined when uri does not match any project', () => {
    const result = projectFromUri('/some/other/path/file.dart', projects);
    assert.strictEqual(result, undefined);
  });

  test('returns undefined for empty project list', () => {
    const result = projectFromUri('/ws/apps/my_app', []);
    assert.strictEqual(result, undefined);
  });

  test('returns the most specific (longest path) match', () => {
    const nestedProjects: FxProject[] = [
      makeProject('workspace', '/ws'),
      makeProject('my_app', '/ws/apps/my_app'),
    ];
    const result = projectFromUri('/ws/apps/my_app/pubspec.yaml', nestedProjects);
    assert.ok(result, 'expected a project to be found');
    assert.strictEqual(result!.name, 'my_app', 'should match most specific path');
  });
});
