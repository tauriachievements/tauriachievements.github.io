import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';
import { getLocalTimeZoneLabel } from '../../core/time-zone-label';
import { getArmoryUrl } from '../../game/armory';
import { getClassColor } from '../../game/class-colors';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { FindingRow, FindingsScan, RareItemFindingsFile, findingScans } from './rare-item-findings';
import { ElitePvpItemsFile, decodeEliteCatalog } from './rare-items';

@Component({
  selector: 'app-rare-item-findings-page',
  templateUrl: './rare-item-findings-page.component.html',
  styleUrls: ['./rare-items-page.component.scss', './rare-item-findings-page.component.scss'],
  imports: [DatePipe, RouterLink, SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RareItemFindingsPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly scans = signal<FindingsScan[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly timeZoneLabel = computed(() => getLocalTimeZoneLabel(this.scans()[0]?.scannedAt));

  ngOnInit(): void {
    this.loadData();
  }

  retryLoad(): void {
    this.loadData();
  }

  armoryUrl(row: FindingRow): string {
    return getArmoryUrl(row.character.name, row.character.realm);
  }

  classColor(row: FindingRow): string {
    return getClassColor(row.character.class) ?? '#b7df86';
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);

    forkJoin({
      findings: this.dataFiles.getJson<RareItemFindingsFile>('RareItemFindings.json'),
      catalog: this.dataFiles.getJson<ElitePvpItemsFile>('elite-pvp-items.json')
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ findings, catalog }) => {
          try {
            this.scans.set(findingScans(findings, decodeEliteCatalog(catalog)));
          } catch (error) {
            this.fail(error);
            return;
          }
          this.isLoading.set(false);
        },
        error: error => this.fail(error)
      });
  }

  private fail(error: unknown): void {
    console.error('Failed to load rare item findings:', error);
    this.loadError.set('The new findings could not be loaded. Please try again.');
    this.isLoading.set(false);
  }
}
