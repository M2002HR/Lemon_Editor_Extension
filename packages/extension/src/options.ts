import type { PdfDensity, PdfDirection, PdfFontSize, PdfRenderOptions } from './types.js';

const SETTINGS_STORAGE_KEY = 'mdpdf_export_options';

const defaultExportOptions: PdfRenderOptions = {
  direction: 'auto',
  pageNumbers: false,
  pageBorder: false,
  smartPagination: true,
  fontSize: 'medium',
  density: 'normal',
  codeWrap: false
};

const directionSet = new Set<PdfDirection>(['auto', 'rtl', 'ltr']);
const fontSizeSet = new Set<PdfFontSize>(['small', 'medium', 'large']);
const densitySet = new Set<PdfDensity>(['compact', 'normal', 'relaxed']);

export function getDefaultExportOptions(): PdfRenderOptions {
  return { ...defaultExportOptions };
}

export async function getStoredExportOptions(): Promise<PdfRenderOptions> {
  const data = await storageGet(SETTINGS_STORAGE_KEY);
  const raw = data[SETTINGS_STORAGE_KEY];
  return normalizeExportOptions(raw);
}

export async function saveExportOptions(options: PdfRenderOptions): Promise<void> {
  const normalized = normalizeExportOptions(options);
  await storageSet({ [SETTINGS_STORAGE_KEY]: normalized });
}

export function normalizeExportOptions(input: unknown): PdfRenderOptions {
  if (!input || typeof input !== 'object') {
    return getDefaultExportOptions();
  }

  const candidate = input as Record<string, unknown>;

  return {
    direction: parseEnum(candidate.direction, directionSet, defaultExportOptions.direction),
    pageNumbers: parseBool(candidate.pageNumbers, defaultExportOptions.pageNumbers),
    pageBorder: parseBool(candidate.pageBorder, defaultExportOptions.pageBorder),
    smartPagination: parseBool(candidate.smartPagination, defaultExportOptions.smartPagination),
    fontSize: parseEnum(candidate.fontSize, fontSizeSet, defaultExportOptions.fontSize),
    density: parseEnum(candidate.density, densitySet, defaultExportOptions.density),
    codeWrap: parseBool(candidate.codeWrap, defaultExportOptions.codeWrap)
  };
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function parseEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  if (typeof value !== 'string') {
    return fallback;
  }

  if (allowed.has(value as T)) {
    return value as T;
  }

  return fallback;
}

function storageGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(key, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(items as Record<string, unknown>);
    });
  });
}

function storageSet(data: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve();
    });
  });
}
