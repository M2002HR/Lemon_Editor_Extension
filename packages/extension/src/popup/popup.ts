import { getStoredExportOptions, saveExportOptions } from '../options.js';
import type { PdfRenderOptions } from '../types.js';

void init();

async function init() {
  const status = document.getElementById('status');
  const form = document.getElementById('settings-form') as HTMLFormElement | null;

  if (!form || !status) {
    return;
  }

  const settings = await getStoredExportOptions().catch(() => null);
  if (settings) {
    applySettingsToForm(form, settings);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Saving...';

    try {
      const next = readSettingsFromForm(form);
      await saveExportOptions(next);
      status.textContent = 'Saved';
      window.setTimeout(() => {
        status.textContent = '';
      }, 1500);
    } catch {
      status.textContent = 'Failed to save settings';
    }
  });
}

function applySettingsToForm(form: HTMLFormElement, options: PdfRenderOptions) {
  (form.elements.namedItem('direction') as HTMLSelectElement).value = options.direction;
  (form.elements.namedItem('fontSize') as HTMLSelectElement).value = options.fontSize;
  (form.elements.namedItem('density') as HTMLSelectElement).value = options.density;
  (form.elements.namedItem('smartPagination') as HTMLInputElement).checked = options.smartPagination;
  (form.elements.namedItem('pageBorder') as HTMLInputElement).checked = options.pageBorder;
  (form.elements.namedItem('pageNumbers') as HTMLInputElement).checked = options.pageNumbers;
  (form.elements.namedItem('codeWrap') as HTMLInputElement).checked = options.codeWrap;
}

function readSettingsFromForm(form: HTMLFormElement): PdfRenderOptions {
  return {
    direction: (form.elements.namedItem('direction') as HTMLSelectElement).value as PdfRenderOptions['direction'],
    fontSize: (form.elements.namedItem('fontSize') as HTMLSelectElement).value as PdfRenderOptions['fontSize'],
    density: (form.elements.namedItem('density') as HTMLSelectElement).value as PdfRenderOptions['density'],
    smartPagination: (form.elements.namedItem('smartPagination') as HTMLInputElement).checked,
    pageBorder: (form.elements.namedItem('pageBorder') as HTMLInputElement).checked,
    pageNumbers: (form.elements.namedItem('pageNumbers') as HTMLInputElement).checked,
    codeWrap: (form.elements.namedItem('codeWrap') as HTMLInputElement).checked
  };
}
