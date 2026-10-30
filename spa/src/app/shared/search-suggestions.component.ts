import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SearchSuggestion } from './search-suggestions';

@Component({
  selector: 'app-search-suggestions',
  imports: [RouterLink],
  templateUrl: './search-suggestions.component.html',
  styleUrls: ['./search-suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(focusin)': 'open.set(true)',
    '(focusout)': 'onFocusOut($event)'
  }
})
export class SearchSuggestionsComponent {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  readonly query = model('');
  readonly suggestions = input.required<readonly SearchSuggestion[]>();
  readonly label = input.required<string>();
  readonly listLabel = input.required<string>();
  readonly noMatchText = input.required<string>();
  readonly ready = input(true);

  readonly open = signal(false);
  readonly noMatch = computed(() => this.ready() && !!this.query().trim() && !this.suggestions().length);

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
      this.router.navigate(first.link, { queryParams: first.queryParams });
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
