import { buildDefaultFilename as sharedBuildDefaultFilename } from '../shared/filename.js';

export const ENHANCED_ATTRIBUTE = 'data-mdpdf-enhanced';
export const ACTION_CLASS = 'mdpdf-action-row';

export function findAssistantMessages(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]'));
}

export function extractMessageHtml(messageElement: HTMLElement): string {
  const clone = messageElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`.${ACTION_CLASS}`).forEach((element) => element.remove());
  clone.querySelectorAll('button, textarea').forEach((element) => element.remove());

  const contentElement = clone.querySelector<HTMLElement>('.markdown, .prose, [data-message-content], [dir]');
  if (contentElement) {
    return contentElement.innerHTML;
  }

  return clone.innerHTML;
}

export function buildDefaultFilename(date = new Date()): string {
  return sharedBuildDefaultFilename(date);
}
