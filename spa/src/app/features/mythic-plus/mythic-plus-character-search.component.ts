import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input, linkedSignal } from '@angular/core';
import { SearchSuggestionsComponent } from '../../shared/search-suggestions.component';
import { PlayerScore } from './mythic-plus';
import { characterSuggestion, searchCharacters } from './mythic-plus-profile';

const SUGGESTION_COUNT = 8;

@Component({
  selector: 'app-mythic-plus-character-search',
  imports: [SearchSuggestionsComponent],
  template: `
    <app-search-suggestions
      label="Find a character"
      listLabel="Matching characters"
      noMatchText="No player by that name."
      [suggestions]="suggestions()"
      [ready]="ranking().length > 0"
      [(query)]="query" />
  `,
  styleUrls: ['./mythic-plus-character-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusCharacterSearchComponent {
  private readonly locale = inject(LOCALE_ID);

  readonly ranking = input.required<readonly PlayerScore[]>();
  readonly character = input<string>();

  readonly query = linkedSignal<string | undefined, string>({ source: this.character, computation: () => '' });
  readonly suggestions = computed(() => searchCharacters(this.ranking(), this.query(), { limit: SUGGESTION_COUNT })
    .map(link => characterSuggestion(link, this.locale)));
}
