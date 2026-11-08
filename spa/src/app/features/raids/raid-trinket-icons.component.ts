import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ITEM_QUALITY_COLORS, iconSrcset, itemIconUrl, itemUrl } from './raid-display';
import { RaidTrinket } from './raid-logs.types';

@Component({
  selector: 'app-raid-trinket-icons',
  template: `
    @for (trinket of trinkets(); track $index) {
      <a
        class="icon"
        [style.border-color]="qualityColor(trinket.quality)"
        [href]="itemUrl(trinket.id)"
        target="_blank"
        rel="noopener"
        [attr.aria-label]="trinket.name + ', item level ' + trinket.itemLevel"
        [attr.data-tip]="trinket.name"
        [attr.data-tip-color]="qualityColor(trinket.quality)"
        [attr.data-tip-note]="'Item level ' + trinket.itemLevel">
        <img [src]="icon(trinket.icon, 'medium')" [srcset]="iconSrcset(trinket.icon)" sizes="22px" width="22" height="22" alt="" loading="lazy" />
      </a>
    } @empty {
      <span class="none">-</span>
    }
  `,
  styleUrl: './raid-trinket-icons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidTrinketIconsComponent {
  readonly trinkets = input.required<ReadonlyArray<RaidTrinket>>();

  readonly itemUrl = itemUrl;
  readonly icon = itemIconUrl;
  readonly iconSrcset = iconSrcset;

  qualityColor(quality: number): string {
    return ITEM_QUALITY_COLORS[quality] ?? '#fff';
  }
}
