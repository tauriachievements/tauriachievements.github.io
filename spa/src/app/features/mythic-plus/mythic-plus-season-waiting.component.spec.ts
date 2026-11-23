import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MythicPlusSeasonWaitingComponent } from './mythic-plus-season-waiting.component';

describe('MythicPlusSeasonWaitingComponent', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render() {
    const fixture = TestBed.createComponent(MythicPlusSeasonWaitingComponent);
    fixture.componentRef.setInput('season', { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0', upcoming: true });
    fixture.componentRef.setInput('current', { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3', upcoming: false });
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  const queueTime = (element: HTMLElement) => element.querySelector('.queue-time')?.textContent?.trim();

  it('names the season that has not started and counts the time in queue up every second', () => {
    const { fixture, element } = render();

    expect(element.querySelector('h2')?.textContent?.trim()).toBe("Season 2 - Patch 7.1.0 hasn't started yet");
    expect(queueTime(element)).toBe('0:00');

    vi.advanceTimersByTime(65_000);
    fixture.detectChanges();
    expect(queueTime(element)).toBe('1:05');
  });

  it('leaves the queue for the season with data', () => {
    const { fixture, element } = render();
    const left = vi.fn();
    fixture.componentInstance.leave.subscribe(left);

    const button = element.querySelector<HTMLButtonElement>('.leave-queue');
    button?.click();

    expect(button?.getAttribute('aria-label')).toBe('Leave queue: back to Season 1 - Patch 7.0.3');
    expect(left.mock.calls).toEqual([['legion-s1']]);
  });

  it('stops the clock once it is gone', () => {
    const { fixture } = render();
    const running = vi.getTimerCount();

    fixture.destroy();

    expect(running).toBeGreaterThan(0);

    expect(vi.getTimerCount()).toBe(0);
  });
});
