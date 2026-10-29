import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LegionKeyHistoryPageComponent } from './legion-key-history-page.component';

async function render(
  { downloaded = true } = {}
): Promise<{ fixture: ComponentFixture<LegionKeyHistoryPageComponent>; element: HTMLElement }> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(LegionKeyHistoryPageComponent);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  if (downloaded) {
    element.querySelectorAll('.showcase-image').forEach(image => image.dispatchEvent(new Event('load')));
    await fixture.whenStable();
  }
  return { fixture, element };
}

const activeTab = (element: HTMLElement) => element.querySelector('.showcase-tab.is-active')?.textContent?.trim();
const shownImage = (element: HTMLElement) => element.querySelector<HTMLImageElement>('.showcase-image.is-active')?.getAttribute('src');
const timer = (element: HTMLElement) => element.querySelector<HTMLElement>('.showcase-progress');
const tab = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll<HTMLButtonElement>('.showcase-tab')].find(button => button.textContent?.trim() === label)!;

function pointer(type: 'pointerenter' | 'pointerleave', pointerType: string): Event {
  return Object.assign(new Event(type), { pointerType });
}

async function runOut(fixture: ComponentFixture<LegionKeyHistoryPageComponent>, element: HTMLElement): Promise<void> {
  timer(element)!.dispatchEvent(new Event('animationend'));
  await fixture.whenStable();
}

describe('LegionKeyHistoryPageComponent screenshots', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the next screenshot when the active tab’s timer runs out', async () => {
    const { fixture, element } = await render();

    expect(activeTab(element)).toBe('Leaderboard');
    expect(timer(element)?.closest('.showcase-tab')?.textContent?.trim()).toBe('Leaderboard');
    expect(timer(element)?.style.animationDuration).toBe('7000ms');

    await runOut(fixture, element);

    expect(activeTab(element)).toBe('Every run');
    expect(shownImage(element)).toBe('assets/legion-key-history/runs.webp');
    expect(timer(element)?.closest('.showcase-tab')?.textContent?.trim()).toBe('Every run');
  });

  it('goes back to the first screenshot after the last', async () => {
    const { fixture, element } = await render();

    for (let step = 0; step < 4; step++) {
      await runOut(fixture, element);
    }

    expect(activeTab(element)).toBe('Leaderboard');
  });

  it('stops rotating once the reader picks a tab', async () => {
    const { fixture, element } = await render();
    expect(timer(element)).not.toBeNull();

    tab(element, 'Compare').click();
    await fixture.whenStable();

    expect(activeTab(element)).toBe('Compare');
    expect(timer(element)).toBeNull();
  });

  it('stops rotating once keyboard focus reaches the tabs', async () => {
    const { fixture, element } = await render();
    expect(timer(element)).not.toBeNull();

    tab(element, 'Every run').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();

    expect(activeTab(element)).toBe('Leaderboard');
    expect(timer(element)).toBeNull();
  });

  it('pauses while a mouse is over the screenshots, not on a touch', async () => {
    const { fixture, element } = await render();
    const showcase = element.querySelector('.showcase')!;

    showcase.dispatchEvent(pointer('pointerenter', 'touch'));
    await fixture.whenStable();
    expect(timer(element)?.classList).not.toContain('is-paused');

    showcase.dispatchEvent(pointer('pointerenter', 'mouse'));
    await fixture.whenStable();
    expect(timer(element)?.classList).toContain('is-paused');

    showcase.dispatchEvent(pointer('pointerleave', 'mouse'));
    await fixture.whenStable();
    expect(timer(element)?.classList).not.toContain('is-paused');
  });

  it('runs only while at least half the screenshots are on screen', async () => {
    let report: IntersectionObserverCallback = () => undefined;
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        report = callback;
      }

      observe(): void {}

      disconnect(): void {}
    });
    const { fixture, element } = await render();
    const scrollTo = async (ratio: number) => {
      report([{ intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
      await fixture.whenStable();
    };

    expect(timer(element)?.classList).toContain('is-paused');

    await scrollTo(.6);
    expect(timer(element)?.classList).not.toContain('is-paused');

    await scrollTo(.2);
    expect(timer(element)?.classList).toContain('is-paused');
  });

  it('waits until the shown screenshot has downloaded', async () => {
    const { fixture, element } = await render({ downloaded: false });
    const images = element.querySelectorAll('.showcase-image');

    expect(timer(element)?.classList).toContain('is-paused');

    images[0].dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(timer(element)?.classList).not.toContain('is-paused');

    await runOut(fixture, element);
    expect(activeTab(element)).toBe('Every run');
    expect(timer(element)?.classList).toContain('is-paused');

    images[1].dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(timer(element)?.classList).not.toContain('is-paused');
  });

  it('does not rotate when the reader prefers reduced motion', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      media,
      matches: media.includes('prefers-reduced-motion: reduce'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
    const { element } = await render();

    expect(activeTab(element)).toBe('Leaderboard');
    expect(timer(element)).toBeNull();
  });
});
