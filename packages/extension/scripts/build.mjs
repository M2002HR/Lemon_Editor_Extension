import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extensionRoot, '../..');
const srcDir = path.resolve(extensionRoot, 'src');
const outDir = path.resolve(extensionRoot, 'dist');
const watchMode = process.argv.includes('--watch');

loadDotenv({ path: path.join(repoRoot, '.env'), quiet: true });

const extensionApiBaseUrl = (process.env.EXTENSION_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const filenamePrefix = process.env.EXTENSION_FILENAME_PREFIX ?? 'chatgpt-answer';
const borderContentPaddingMm =
  process.env.EXTENSION_PDF_BORDER_CONTENT_PADDING_MM ?? process.env.SERVICE_PDF_BORDER_CONTENT_PADDING_MM ?? '10';

const buildOptions = {
  absWorkingDir: extensionRoot,
  entryPoints: {
    background: path.join(srcDir, 'background.ts'),
    content: path.join(srcDir, 'content.ts'),
    popup: path.join(srcDir, 'popup/popup.ts')
  },
  outdir: outDir,
  bundle: true,
  format: 'iife',
  target: ['chrome120'],
  sourcemap: watchMode,
  logLevel: 'info',
  define: {
    __MDPDF_EXTENSION_API_BASE_URL__: JSON.stringify(extensionApiBaseUrl),
    __MDPDF_FILENAME_PREFIX__: JSON.stringify(filenamePrefix),
    __MDPDF_PDF_BORDER_CONTENT_PADDING_MM__: JSON.stringify(borderContentPaddingMm)
  }
};

if (watchMode) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  await copyStaticAssets(extensionApiBaseUrl);
  console.log('Watching extension sources...');
} else {
  await esbuild.build(buildOptions);
  await copyStaticAssets(extensionApiBaseUrl);
  console.log('Extension build completed.');
}

async function copyStaticAssets(apiBaseUrl) {
  await mkdir(outDir, { recursive: true });
  await writeManifest(apiBaseUrl);
  await cp(path.join(srcDir, 'popup/popup.html'), path.join(outDir, 'popup.html'));
  await cp(path.join(srcDir, 'popup/popup.css'), path.join(outDir, 'popup.css'));
  await cp(path.join(srcDir, 'assets/icons'), path.join(outDir, 'icons'), { recursive: true });
  await cp(path.join(srcDir, 'assets/ui-icons'), path.join(outDir, 'ui-icons'), { recursive: true });
  await cp(path.join(srcDir, 'assets/fonts'), path.join(outDir, 'fonts'), { recursive: true });
  await cp(path.join(srcDir, 'assets/branding/derived'), path.join(outDir, 'branding'), { recursive: true });
}

async function writeManifest(apiBaseUrl) {
  const manifestPath = path.join(srcDir, 'manifest.json');
  const manifestRaw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestRaw);

  const apiOriginPattern = toHostPermission(apiBaseUrl);
  if (apiOriginPattern) {
    const others = (manifest.host_permissions ?? []).filter((item) => !/^https?:\/\/localhost(:\d+)?\/\*$/.test(item));
    manifest.host_permissions = [...others, apiOriginPattern];
  }

  await writeFile(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function toHostPermission(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return `${url.origin}/*`;
  } catch {
    return null;
  }
}
