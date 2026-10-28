import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  viewChild
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PlayerScore } from './mythic-plus';
import { searchCharacters } from './mythic-plus-profile';

const SUGGESTION_COUNT = 8;

@Component({
  selector: 'app-mythic-plus-character-search',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './mythic-plus-character-search.component.html',
  styleUrls: ['./mythic-plus-character-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(focusin)': 'open.set(true)',
    '(focusout)': 'onFocusOut($event)'
  }
})
export class MythicPlusCharacterSearchComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  readonly ranking = input.required<readonly PlayerScore[]>();
  readonly character = input<string>();

  readonly query = linkedSignal<string | undefined, string>({ source: this.character, computation: () => '' });
  readonly open = signal(false);
  readonly suggestions = computed(() => searchCharacters(this.ranking(), this.query(), { limit: SUGGESTION_COUNT }));
  readonly noMatch = computed(() => !!this.query().trim() && !!this.ranking().length && !this.suggestions().length);

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  onFocusOut(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.open.set(false);
    }
  }

  openFirst(): void {
    const [first] = this.suggestions();
    if (first) {
      this.router.navigate(first.member.profileLink);
      this.picked();
    }
  }

  picked(): void {
    this.query.set('');
    this.searchInput().nativeElement.blur();
  }

  clear(): void {
    this.query.set('');
  }
}
