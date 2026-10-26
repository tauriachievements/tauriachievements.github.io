import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { LoadStateComponent } from './load-state.component';
import { SkeletonBlock } from './skeleton';

interface LoadStateInputs {
  loading: boolean;
  error?: string;
  loadingText?: string;
  skeleton?: readonly SkeletonBlock[];
}

async function renderLoadState(inputs: LoadStateInputs) {
  await TestBed.configureTestingModule({ imports: [LoadStateComponent] }).compileComponents();
  const fixture = TestBed.createComponent(LoadStateComponent);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  let retries = 0;
  fixture.componentInstance.retry.subscribe(() => retries++);
  return { fixture, element: fixture.nativeElement as HTMLElement, retries: () => retries };
}

describe('LoadStateComponent', () => {
  it('shows the page skeleton while loading, and says what it is loading', async () => {
    const { element } = await renderLoadState({ loading: true, loadingText: 'Reading the logs...', skeleton: ['tiles:4', 'rows:5'] });

    expect(element.querySelector('app-skeleton')).not.toBeNull();
    expect(element.querySelectorAll('.tile').length).toBe(4);
    expect(element.querySelector('.spinner')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('Reading the logs...');
  });

  it('falls back to the spinner when the page gives no skeleton', async () => {
    const { element } = await renderLoadState({ loading: true, loadingText: 'Loading runs...' });

    expect(element.querySelector('app-skeleton')).toBeNull();
    expect(element.querySelector('.spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading runs...');
  });

  it('shows the error with Try again once loading has failed', async () => {
    const { element, retries } = await renderLoadState({ loading: false, error: 'The raid logs could not be loaded.', skeleton: ['rows:5'] });

    expect(element.querySelector('app-skeleton')).toBeNull();
    expect(element.textContent).toContain('The raid logs could not be loaded.');
    element.querySelector('button')?.click();
    expect(retries()).toBe(1);
  });

  it('renders nothing once loaded', async () => {
    const { fixture, element } = await renderLoadState({ loading: true, skeleton: ['rows:5'] });

    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    expect(element.children.length).toBe(0);
  });
});
