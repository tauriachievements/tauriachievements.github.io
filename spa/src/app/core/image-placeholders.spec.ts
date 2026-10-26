import { afterEach, describe, expect, it } from 'vitest';
import { markSettledImages } from './image-placeholders';

describe('markSettledImages', () => {
  let stop: (() => void) | undefined;

  afterEach(() => {
    stop?.();
    document.body.replaceChildren();
  });

  function addImage(): HTMLImageElement {
    const image = document.createElement('img');
    document.body.append(document.createElement('div'));
    document.body.lastElementChild?.append(image);
    return image;
  }

  it('marks an image once it has loaded, wherever it sits in the page', () => {
    stop = markSettledImages(document);
    const image = addImage();

    expect(image.hasAttribute('data-loaded')).toBe(false);
    image.dispatchEvent(new Event('load'));

    expect(image.hasAttribute('data-loaded')).toBe(true);
  });

  it('marks an image that failed, so its placeholder stops', () => {
    stop = markSettledImages(document);
    const image = addImage();

    image.dispatchEvent(new Event('error'));

    expect(image.hasAttribute('data-loaded')).toBe(true);
  });

  it('leaves other elements alone', () => {
    stop = markSettledImages(document);
    const frame = document.createElement('iframe');
    document.body.append(frame);

    frame.dispatchEvent(new Event('load'));

    expect(frame.hasAttribute('data-loaded')).toBe(false);
  });

  it('stops marking once stopped', () => {
    markSettledImages(document)();
    const image = addImage();

    image.dispatchEvent(new Event('load'));

    expect(image.hasAttribute('data-loaded')).toBe(false);
  });
});
