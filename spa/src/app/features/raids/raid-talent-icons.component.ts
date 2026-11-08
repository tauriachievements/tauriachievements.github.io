import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { iconSrcset, itemIconUrl, spellUrl } from './raid-display';
import { RaidTalent } from './raid-logs.types';

@Component({
  selector: 'app-raid-talent-icons',
  template: `
    @for (talent of talents(); track $index) {
      @if (talent) {
        <a
          class="icon"
          [href]="spellUrl(talent.id)"
          target="_blank"
          rel="noopener"
          [attr.aria-label]="talent.name"
          [attr.data-tip]="talent.name"
          [attr.data-tip-spell]="talent.id">
          <img [src]="icon(talent.icon, 'medium')" [srcset]="iconSrcset(talent.icon)" sizes="22px" width="22" height="22" alt="" loading="lazy" />
        </a>
      } @else {
        <span class="icon empty" data-tip="No talent picked"></span>
      }
    } @empty {
      <span class="none">-</span>
    }
  `,
  styleUrl: './raid-talent-icons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidTalentIconsComponent {
  readonly talents = input.required<ReadonlyArray<RaidTalent | undefined>>();

  readonly spellUrl = spellUrl;
  readonly icon = itemIconUrl;
  readonly iconSrcset = iconSrcset;
}
