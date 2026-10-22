import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * The phone-only button that opens a page's collapsed filter panel, with the active
 * filters listed as chips under it while the panel is closed.
 *
 * Above 640 px it renders nothing. Below, its host is `display: contents`, so the button
 * and chips lay out as items of the page's own filter grid.
 */
@Component({
  selector: 'app-mobile-filter-toggle',
  templateUrl: './mobile-filter-toggle.component.html',
  styleUrls: ['./mobile-filter-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileFilterToggleComponent {
  /** Id of the element the button shows and hides. */
  readonly controlsId = input.required<string>();
  readonly label = input('Filters');
  readonly expanded = input(false);
  /** Labels of the filters that differ from the page's defaults. */
  readonly activeFilters = input<ReadonlyArray<string>>([]);

  readonly expandedChange = output<boolean>();

  readonly ariaLabel = computed(() => {
    const count = this.activeFilters().length;
    return count > 0 ? `${this.label()}, ${count} active` : this.label();
  });

  toggle(): void {
    this.expandedChange.emit(!this.expanded());
  }
}
