import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, '..');
const srcDir = path.resolve(extensionRoot, 'src');
const outDir = path.resolve(extensionRoot, 'dist');
const watchMode = process.argv.includes('--watch');

const buildOptions = {
  absWorkingDir: extensionRoot,
  entryPoints: {
    background: path.join(srcDir, 'background.ts'),
    content: path.join(srcDir, 'content.ts')
  },
  outdir: outDir,
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  sourcemap: watchMode,
  logLevel: 'info'
};

if (watchMode) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyManifest();
  console.log('Watching extension sources...');
} else {
  await esbuild.build(buildOptions);
  await copyManifest();
  console.log('Extension build completed.');
}

async function copyManifest() {
  await mkdir(outDir, { recursive: true });
  await cp(path.join(srcDir, 'manifest.json'), path.join(outDir, 'manifest.json'));
}
