import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SkeletonBlock } from './skeleton';
import { SkeletonComponent } from './skeleton.component';

async function renderSkeleton(blocks: readonly SkeletonBlock[], label?: string): Promise<HTMLElement> {
  await TestBed.configureTestingModule({ imports: [SkeletonComponent] }).compileComponents();
  const fixture = TestBed.createComponent(SkeletonComponent);
  fixture.componentRef.setInput('blocks', blocks);
  if (label !== undefined) {
    fixture.componentRef.setInput('label', label);
  }
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('SkeletonComponent', () => {
  it('draws the blocks in the order the page lists them', async () => {
    const element = await renderSkeleton(['hero', 'tiles:5', 'switch:2', 'rows:3']);

    const blocks = [...element.querySelectorAll('.skeleton > *')].map(block => block.classList[block.classList.length - 1]);
    expect(blocks).toEqual(['hero', 'tiles', 'switch', 'table']);
    expect(element.querySelectorAll('.tile').length).toBe(5);
    expect(element.querySelectorAll('.switch .pill').length).toBe(2);
    expect(element.querySelectorAll('.table .row:not(.head)').length).toBe(3);
  });

  it('draws a chart whose bars fall from the first to the last', async () => {
    const element = await renderSkeleton(['chart:4']);

    const shares = [...element.querySelectorAll<HTMLElement>('.bar')].map(bar => bar.style.getPropertyValue('--share'));
    expect(shares).toEqual(['96%', '70%', '44%', '18%']);
  });

  it('hides the shapes from screen readers and announces the label instead', async () => {
    const element = await renderSkeleton(['rows:2'], 'Reading the logs...');

    expect(element.querySelector('.skeleton')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('[role="status"]')?.textContent?.trim()).toBe('Reading the logs...');
  });

  it('drops its frames when bare, for a skeleton inside a card that is already on screen', async () => {
    await TestBed.configureTestingModule({ imports: [SkeletonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('blocks', ['chart']);
    fixture.componentRef.setInput('bare', '');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.skeleton').classList).toContain('bare');
  });

  it('announces nothing without a label', async () => {
    const element = await renderSkeleton(['rows:2']);

    expect(element.querySelector('[role="status"]')).toBeNull();
  });
});
