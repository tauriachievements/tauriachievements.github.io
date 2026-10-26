import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import { SkeletonBlock, barShare, iconColumns, nameWidth, skeletonSections } from './skeleton';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SkeletonComponent {
  readonly blocks = input.required<readonly SkeletonBlock[]>();
  readonly label = input<string>();
  readonly bare = input(false, { transform: booleanAttribute });

  protected readonly sections = computed(() => skeletonSections(this.blocks()));
  protected readonly nameWidth = nameWidth;
  protected readonly barShare = barShare;
  protected readonly iconColumns = iconColumns;
}
