import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';
import { setPageHeader } from '../../core/page-header';
import { getArmoryUrl } from '../../game/armory';
import { getClassColor } from '../../game/class-colors';
import { getClassIconPath } from '../../game/classIconHelper';
import { CLASS_NAMES } from '../../game/wow';
import { LoadStateComponent } from '../../shared/load-state.component';
import {
  CHARACTER_LIST_FILE,
  CharacterList,
  CharacterListFile,
  CharacterListRow,
  MAX_LEVEL,
  ORDER_HALL_UPGRADES,
  TIER_LIST_DIFFICULTY,
  characterListRows,
  decodeCharacterList
} from './character-list';
import { RaidLogsDataService } from './raid-logs-data.service';
import { RoleTierList, tierLists } from './raid-tier-list';

@Component({
  selector: 'app-character-list-page',
  imports: [LoadStateComponent, DecimalPipe, NgTemplateOutlet, RouterLink],
  templateUrl: './character-list-page.component.html',
  styleUrl: './character-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterListPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly raidLogs = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly maxLevel = MAX_LEVEL;
  readonly orderHallSteps = Array.from({ length: ORDER_HALL_UPGRADES }, (_, step) => step);
  readonly orderHallUpgrades = ORDER_HALL_UPGRADES;
  readonly tierListDifficulty = TIER_LIST_DIFFICULTY;
  readonly list = signal<CharacterList | undefined>(undefined);
  readonly tiers = signal<readonly RoleTierList[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly rows = computed(() => characterListRows(this.list()?.characters ?? [], this.tiers()));

  constructor() {
    setPageHeader(() => ({ lastEdited: this.list()?.generatedAt }));
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    forkJoin({
      list: this.dataFiles.getJson<CharacterListFile>(CHARACTER_LIST_FILE).pipe(map(decodeCharacterList)),
      tiers: this.mythicTierLists()
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ list, tiers }) => {
          this.list.set(list);
          this.tiers.set(tiers);
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the character list:', error);
          this.loadError.set('The character list could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }

  className(row: CharacterListRow): string {
    return CLASS_NAMES[row.character.class] ?? '';
  }

  classColor(row: CharacterListRow): string | undefined {
    return getClassColor(row.character.class);
  }

  icon(row: CharacterListRow): string {
    return row.spec?.icon ?? getClassIconPath(row.character.class);
  }

  armoryUrl(row: CharacterListRow): string {
    return getArmoryUrl(row.character.name, this.list()?.realm ?? '');
  }

  private mythicTierLists(): Observable<RoleTierList[]> {
    return this.raidLogs.index().pipe(switchMap(index => {
      const difficulty = index.difficulties.find(entry => entry.slug === TIER_LIST_DIFFICULTY && entry.kills > 0);
      return difficulty
        ? this.raidLogs.difficultyKills(index, difficulty).pipe(map(kills => tierLists(index.bosses, kills, difficulty.slug)))
        : of([]);
    }));
  }
}
