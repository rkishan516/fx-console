import * as assert from 'assert';
import { filterGenerators } from '../utils/generatorFilter';
import { FxGenerator } from '../types';

// Test the form validation logic that mirrors what generator.js does in the webview
// The GeneratorPanel class requires vscode; test the validation logic independently

function validateDartName(name: string): string | null {
  if (!name) return 'Project name is required';
  if (!/^[a-z][a-z0-9_]*$/.test(name)) {
    return 'Must be a valid Dart identifier: lowercase letters, digits, and underscores. Must start with a letter.';
  }
  return null;
}

suite('GeneratorPanel (form validation)', () => {
  test('valid Dart identifiers pass validation', () => {
    assert.strictEqual(validateDartName('my_package'), null);
    assert.strictEqual(validateDartName('flutter_app'), null);
    assert.strictEqual(validateDartName('core'), null);
    assert.strictEqual(validateDartName('a'), null);
    assert.strictEqual(validateDartName('pkg123'), null);
  });

  test('invalid Dart identifiers fail validation', () => {
    assert.ok(validateDartName('') !== null, 'empty should fail');
    assert.ok(validateDartName('MyPackage') !== null, 'uppercase should fail');
    assert.ok(validateDartName('my package') !== null, 'spaces should fail');
    assert.ok(validateDartName('my-package') !== null, 'hyphens should fail');
    assert.ok(validateDartName('1package') !== null, 'starting with digit should fail');
    assert.ok(validateDartName('_package') !== null, 'starting with underscore should fail');
  });

  test('generator command args are built correctly', () => {
    // Simulate what GeneratorPanel._runGenerate builds
    function buildArgs(generator: string, name: string, directory?: string, dryRun = false): string[] {
      const args = ['generate', generator, name, '--no-interactive'];
      if (directory) { args.push('-d', directory); }
      if (dryRun) { args.push('--dry-run'); }
      return args;
    }

    assert.deepStrictEqual(
      buildArgs('dart_package', 'my_pkg'),
      ['generate', 'dart_package', 'my_pkg', '--no-interactive']
    );

    assert.deepStrictEqual(
      buildArgs('flutter_app', 'my_app', 'apps/', true),
      ['generate', 'flutter_app', 'my_app', '--no-interactive', '-d', 'apps/', '--dry-run']
    );
  });
});

const gen = (name: string): FxGenerator => ({ name, description: `Create ${name}` });

suite('filterGenerators', () => {
  const generators = [gen('dart_package'), gen('flutter_app'), gen('flutter_package'), gen('dart_cli')];

  test('returns all generators when both lists are empty', () => {
    const result = filterGenerators(generators, [], []);
    assert.strictEqual(result.length, 4);
  });

  test('allowlist filters to matching generators', () => {
    const result = filterGenerators(generators, ['dart_*'], []);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some(g => g.name === 'dart_package'));
    assert.ok(result.some(g => g.name === 'dart_cli'));
  });

  test('blocklist removes matching generators', () => {
    const result = filterGenerators(generators, [], ['flutter_*']);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some(g => g.name === 'dart_package'));
    assert.ok(result.some(g => g.name === 'dart_cli'));
  });

  test('allowlist and blocklist combined', () => {
    const result = filterGenerators(generators, ['dart_*', 'flutter_app'], ['dart_cli']);
    assert.strictEqual(result.length, 2);
    assert.ok(result.some(g => g.name === 'dart_package'));
    assert.ok(result.some(g => g.name === 'flutter_app'));
  });

  test('exact name match works', () => {
    const result = filterGenerators(generators, ['flutter_app'], []);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'flutter_app');
  });

  test('? wildcard matches single character', () => {
    const result = filterGenerators(generators, ['dart_???'], []);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'dart_cli');
  });

  test('empty result when nothing matches allowlist', () => {
    const result = filterGenerators(generators, ['nonexistent'], []);
    assert.strictEqual(result.length, 0);
  });
});
