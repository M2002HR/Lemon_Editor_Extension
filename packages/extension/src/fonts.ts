import { FONT_CATALOG } from './fonts.catalog.js';

interface FontItem {
  file: string;
  family: string;
  format: string;
}

const items = (FONT_CATALOG as FontItem[]).filter((item) => item.file && item.family && item.format);

export function getFontFamilies(): string[] {
  return items.map((item) => item.family);
}

export function buildFontFaceCss(): string {
  return items
    .map((item) => {
      const url = chrome.runtime.getURL(`fonts/${item.file}`);
      return `@font-face { font-family: "${escapeCss(item.family)}"; src: url("${url}") format("${item.format}"); font-display: swap; }`;
    })
    .join('\n');
}

function escapeCss(value: string): string {
  return value.replaceAll('"', '\\"');
}
