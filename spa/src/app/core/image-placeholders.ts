export const LOADED_IMAGE_ATTRIBUTE = 'data-loaded';

export function markSettledImages(document: Document): () => void {
  const mark = (event: Event): void => {
    if (event.target instanceof HTMLImageElement) {
      event.target.setAttribute(LOADED_IMAGE_ATTRIBUTE, '');
    }
  };

  document.addEventListener('load', mark, true);
  document.addEventListener('error', mark, true);

  return () => {
    document.removeEventListener('load', mark, true);
    document.removeEventListener('error', mark, true);
  };
}
