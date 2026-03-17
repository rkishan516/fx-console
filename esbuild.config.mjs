import esbuild from 'esbuild';
import { argv } from 'process';

const isWatch = argv.includes('--watch');
const isTest = argv.includes('--test');

const sharedConfig = {
  bundle: true,
  external: ['vscode'],
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
};

async function build() {
  if (isTest) {
    // Build test files
    await esbuild.build({
      ...sharedConfig,
      entryPoints: ['src/test/runTests.ts', 'src/test/fxCli.test.ts', 'src/test/pubspecParser.test.ts'],
      outdir: 'dist/test',
      format: 'cjs',
    });
  } else if (isWatch) {
    const ctx = await esbuild.context({
      ...sharedConfig,
      entryPoints: ['src/extension.ts'],
      outfile: 'dist/extension.js',
      format: 'cjs',
    });
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build({
      ...sharedConfig,
      entryPoints: ['src/extension.ts'],
      outfile: 'dist/extension.js',
      format: 'cjs',
    });
  }
}

build().catch(() => process.exit(1));
