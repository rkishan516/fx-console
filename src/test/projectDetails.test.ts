import * as assert from 'assert';
import { formatProjectForDisplay } from '../utils/projectFormatter';
import { FxProject } from '../types';

const makeProject = (overrides: Partial<FxProject> = {}): FxProject => ({
  name: 'my_app',
  type: 'flutter_app',
  path: '/ws/apps/my_app',
  tags: ['scope:app'],
  dependencies: ['core', 'utils'],
  dependents: ['e2e_tests'],
  targets: {
    build: { executor: 'flutter build', dependsOn: ['core:build'], inputs: ['lib/**'] },
    test: { executor: 'flutter test' },
  },
  ...overrides,
});

suite('formatProjectForDisplay', () => {
  test('extracts name, type, path, tags', () => {
    const result = formatProjectForDisplay(makeProject());
    assert.strictEqual(result.name, 'my_app');
    assert.strictEqual(result.type, 'flutter_app');
    assert.strictEqual(result.path, '/ws/apps/my_app');
    assert.deepStrictEqual(result.tags, ['scope:app']);
  });

  test('formats targets with dependsOn and inputs', () => {
    const result = formatProjectForDisplay(makeProject());
    assert.strictEqual(result.targets.length, 2);
    const build = result.targets.find(t => t.name === 'build')!;
    assert.strictEqual(build.executor, 'flutter build');
    assert.deepStrictEqual(build.dependsOn, ['core:build']);
    assert.deepStrictEqual(build.inputs, ['lib/**']);
  });

  test('defaults dependsOn and inputs to empty arrays when missing', () => {
    const result = formatProjectForDisplay(makeProject());
    const testTarget = result.targets.find(t => t.name === 'test')!;
    assert.deepStrictEqual(testTarget.dependsOn, []);
    assert.deepStrictEqual(testTarget.inputs, []);
  });

  test('passes through dependencies and dependents', () => {
    const result = formatProjectForDisplay(makeProject());
    assert.deepStrictEqual(result.dependencies, ['core', 'utils']);
    assert.deepStrictEqual(result.dependents, ['e2e_tests']);
  });

  test('handles project with no targets', () => {
    const result = formatProjectForDisplay(makeProject({ targets: {} }));
    assert.strictEqual(result.targets.length, 0);
  });

  test('handles project with no tags, deps, or dependents', () => {
    const result = formatProjectForDisplay(makeProject({
      tags: [],
      dependencies: [],
      dependents: [],
    }));
    assert.deepStrictEqual(result.tags, []);
    assert.deepStrictEqual(result.dependencies, []);
    assert.deepStrictEqual(result.dependents, []);
  });
});
