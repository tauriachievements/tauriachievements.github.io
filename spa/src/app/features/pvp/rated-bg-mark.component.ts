import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type RatedBgMark = 'benched' | 'back-from-bench';

const MARK_ICONS: Readonly<Record<RatedBgMark, { readonly label: string; readonly path: string }>> = {
  benched: {
    label: 'On the bench',
    path: 'M3 4h18v2.5H3zM3 8h18v2.5H3zM5 6.5h1.5V13H5zM17.5 6.5H19V13h-1.5zM2 13h20v2.5H2zM4 15.5h2V20H4zM18 15.5h2V20h-2z'
  },
  'back-from-bench': {
    label: 'Back from the bench',
    path: 'M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z'
  }
};

@Component({
  selector: 'app-rated-bg-mark',
  template: '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path [attr.d]="icon().path" /></svg>',
  styleUrl: './rated-bg-mark.component.scss',
  host: {
    '[class]': 'kind()',
    '[attr.title]': 'icon().label',
    '[attr.role]': "decorative() ? null : 'img'",
    '[attr.aria-label]': 'decorative() ? null : icon().label',
    '[attr.aria-hidden]': "decorative() ? 'true' : null"
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatedBgMarkComponent {
  readonly kind = input.required<RatedBgMark>();
  readonly decorative = input(false);

  readonly icon = computed(() => MARK_ICONS[this.kind()]);
}
