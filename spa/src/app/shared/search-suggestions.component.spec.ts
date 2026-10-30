import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { SearchSuggestion } from './search-suggestions';
import { SearchSuggestionsComponent } from './search-suggestions.component';

@Component({ template: '' })
class BlankPageComponent {}

const miracle: SearchSuggestion = {
  key: 'Evermoon/Miracle',
  link: ['/raid-logs', 'guild', 'evermoon', 'Miracle'],
  queryParams: { difficulty: 'mythic' },
  name: 'Miracle',
  mark: '#c8322e',
  detail: 'Evermoon',
  rank: 2,
  value: '7/7',
  valueColor: '#a335ee'
};

const xyhop: SearchSuggestion = {
  key: 'Xyhop|Evermoon',
  link: ['/mythic-plus', 'character', 'evermoon', 'Xyhop'],
  name: 'Xyhop',
  color: '#fff569',
  icon: '/assets/class-icons/4.png',
  iconLabel: 'Rogue',
  detail: 'Evermoon',
  value: '1,064.5'
};

async function renderSearch(inputs: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({
    imports: [SearchSuggestionsComponent],
    providers: [provideRouter([{ path: '**', component: BlankPageComponent }])]
  }).compileComponents();
  const fixture = TestBed.createComponent(SearchSuggestionsComponent);
  fixture.componentRef.setInput('label', 'Find a guild');
  fixture.componentRef.setInput('listLabel', 'Matching guilds');
  fixture.componentRef.setInput('noMatchText', 'No guild by that name in this list.');
  fixture.componentRef.setInput('suggestions', []);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();

  const element: HTMLElement = fixture.nativeElement;
  const input = element.querySelector('input')!;
  const typed: string[] = [];
  fixture.componentInstance.query.subscribe(value => typed.push(value));
  const type = (value: string, suggestions: readonly SearchSuggestion[]) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.componentRef.setInput('suggestions', suggestions);
    fixture.detectChanges();
  };
  const press = (key: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key }));
    fixture.detectChanges();
  };
  const links = () => [...element.querySelectorAll<HTMLAnchorElement>('.suggestions a')];
  return { fixture, element, input, typed, type, press, links };
}

describe('SearchSuggestionsComponent', () => {
  it('labels the box and shows the label as its placeholder', async () => {
    const { element, input } = await renderSearch();

    expect(element.querySelector('.search-field .visually-hidden')?.textContent?.trim()).toBe('Find a guild');
    expect(input.placeholder).toBe('Find a guild…');
  });

  it('hands every keystroke to the page and lists the suggestions it gets back', async () => {
    const { typed, type, links, element } = await renderSearch();
    type('mi', [miracle]);

    expect(typed).toEqual(['mi']);
    expect(element.querySelector('.suggestions')?.getAttribute('aria-label')).toBe('Matching guilds');
    expect(links().map(link => link.getAttribute('href'))).toEqual(['/raid-logs/guild/evermoon/Miracle?difficulty=mythic']);
  });

  it('shows a mark, the name, the detail, the rank and the value in their colours', async () => {
    const { type, links } = await renderSearch();
    type('mi', [miracle]);
    const [row] = links();

    expect(row.querySelector('img')).toBeNull();
    expect(row.querySelector<HTMLElement>('.suggestion-mark')?.style.background).toBe('rgb(200, 50, 46)');
    expect(row.querySelector('.suggestion-name')?.textContent).toBe('Miracle');
    expect(row.querySelector('.suggestion-detail')?.textContent).toBe('Evermoon');
    expect(row.querySelector('.suggestion-rank')?.textContent).toBe('#2');
    expect(row.querySelector('.suggestion-value')?.textContent).toBe('7/7');
    expect(row.querySelector<HTMLElement>('.suggestion-value')?.style.color).toBe('rgb(163, 53, 238)');
  });

  it('shows an icon instead of a mark, and no rank when the suggestion has none', async () => {
    const { type, links } = await renderSearch();
    type('xy', [xyhop]);
    const [row] = links();

    expect(row.querySelector('img')?.getAttribute('src')).toBe('/assets/class-icons/4.png');
    expect(row.querySelector('img')?.getAttribute('alt')).toBe('Rogue');
    expect(row.querySelector('.suggestion-mark')).toBeNull();
    expect(row.querySelector('.suggestion-rank')).toBeNull();
    expect(row.querySelector<HTMLElement>('.suggestion-name')?.style.color).toBe('rgb(255, 245, 105)');
    expect(row.querySelector('.suggestion-value')?.textContent).toBe('1,064.5');
  });

  it('opens the first suggestion on Enter and empties the box', async () => {
    const { fixture, typed, type, press, input } = await renderSearch();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    type('mi', [miracle, xyhop]);
    press('Enter');

    expect(navigate).toHaveBeenCalledWith(miracle.link, { queryParams: miracle.queryParams });
    expect(typed.at(-1)).toBe('');
    expect(fixture.componentInstance.query()).toBe('');
    expect(input.value).toBe('');
  });

  it('does nothing on Enter while nothing matches', async () => {
    const { type, press, typed } = await renderSearch();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    type('zz', []);
    press('Enter');

    expect(navigate).not.toHaveBeenCalled();
    expect(typed).toEqual(['zz']);
  });

  it('empties the box on Escape and when a suggestion is picked', async () => {
    const { fixture, type, press, links } = await renderSearch();
    type('mi', [miracle]);
    press('Escape');
    expect(fixture.componentInstance.query()).toBe('');

    type('mi', [miracle]);
    links()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.query()).toBe('');
  });

  it('closes the list when focus leaves the search', async () => {
    const { fixture, input, type, links } = await renderSearch();
    type('mi', [miracle]);
    expect(links().length).toBe(1);

    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    fixture.detectChanges();
    expect(links().length).toBe(0);
  });

  it('says nothing matches only once the list it searches is ready', async () => {
    const { fixture, element, type } = await renderSearch({ ready: false });
    type('zz', []);
    expect(element.querySelector('.search-empty')).toBeNull();

    fixture.componentRef.setInput('ready', true);
    fixture.detectChanges();
    expect(element.querySelector('.search-empty')?.textContent?.trim()).toBe('No guild by that name in this list.');
  });
});
