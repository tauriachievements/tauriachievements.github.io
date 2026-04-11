import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BackToTopButtonComponent } from './back-to-top-button.component';
import { FilterDropdownCoordinatorService } from './filter-dropdown-coordinator.service';
import { FilterDropdownComponent } from './filter-dropdown.component';
import { FilterDropdownOption } from './filter-dropdown.types';
import { RareAchievementsService } from './rare-achievements.service';
import {
  RareAchievementCharacter,
  RareAchievementDefinition,
  RareAchievementOwnership,
  RareAchievementsDataset
} from './rare-achievements.types';
import { UpdateBarComponent } from './update-bar.component';
import { getGuildArmoryUrl, getArmoryUrl } from '../utils/armory';
import { getClassIconPath } from '../utils/classIconHelper';
import { getRaceIconPath } from '../utils/raceIconHelper';

type CharacterFaction = 'Alliance' | 'Horde';

interface RareAchievementMatchView {
  rank: number;
  name: string;
  realm: string;
  race: number;
  classId: number;
  guild: string;
  faction: CharacterFaction;
  gender: number;
  raceIcon: string;
  classIcon: string;
  obtainedAt: string | null | undefined;
  obtainedAtLabel: string;
  obtainedAtSortValue: number | undefined;
}

const DEFAULT_RACE_ICON_GENDER = 0;
const ALLIANCE_RACE_IDS = new Set<number>([1, 3, 4, 7, 11, 22, 25]);

@Component({
  selector: 'app-rare-achievements-page',
  templateUrl: './rare-achievements-page.component.html',
  styleUrls: ['./rare-achievements-page.component.scss'],
  standalone: true,
  imports: [CommonModule, UpdateBarComponent, BackToTopButtonComponent, FilterDropdownComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [FilterDropdownCoordinatorService]
})
export class RareAchievementsPageComponent implements OnInit {
  private readonly rareAchievementsService = inject(RareAchievementsService);
  private readonly dropdownCoordinator = inject(FilterDropdownCoordinatorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly obtainedAtFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  readonly dataset = signal<RareAchievementsDataset | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly selectedAchievementId = signal<number | undefined>(undefined);
  readonly lastEdited = signal<Date | undefined>(undefined);
  readonly lastEditedTimeZoneLabel = signal('Local time');
  readonly achievementOptions = computed<ReadonlyArray<FilterDropdownOption<number>>>(() =>
    (this.dataset()?.achievements ?? []).map((achievement) => ({
      value: achievement.id,
      label: achievement.name
    }))
  );
  readonly selectedAchievement = computed(() => this.findAchievement(this.selectedAchievementId()));
  readonly selectedAchievementLabel = computed(() => this.selectedAchievement()?.name ?? 'Select rare achievement');
  readonly matchingCharacters = computed<ReadonlyArray<RareAchievementMatchView>>(() => {
    const achievementId = this.selectedAchievementId();
    if (achievementId === undefined) {
      return [];
    }

    return (this.dataset()?.characters ?? [])
      .map((character) => this.toMatchingCharacterView(character, achievementId))
      .filter((character): character is RareAchievementMatchView => character !== undefined)
      .sort((left, right) => this.compareCharacters(left, right))
      .map((character, index) => ({
        ...character,
        rank: index + 1
      }));
  });
  readonly matchCount = computed(() => this.matchingCharacters().length);
  readonly hasSelection = computed(() => this.selectedAchievementId() !== undefined);
  readonly hasMatches = computed(() => this.matchCount() > 0);
  readonly showSelectionPrompt = computed(() => !this.isLoading() && !this.loadError() && !this.hasSelection());
  readonly showEmptyState = computed(() => !this.isLoading() && !this.loadError() && this.hasSelection() && !this.hasMatches());

  readonly getArmoryUrl = getArmoryUrl;
  readonly getGuildArmoryUrl = getGuildArmoryUrl;

  ngOnInit(): void {
    this.loadRareAchievements();
  }

  onAchievementSelection(value: string | number | undefined): void {
    this.dropdownCoordinator.closeAll();
    this.selectedAchievementId.set(this.toAchievementId(value));
  }

  resetFilter(): void {
    this.dropdownCoordinator.closeAll();
    this.selectedAchievementId.set(undefined);
  }

  retryLoad(): void {
    this.loadRareAchievements();
  }

  trackCharacter(_index: number, character: RareAchievementMatchView): string {
    return `${character.realm}::${character.name}`;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    console.error('Failed to load image:', image?.src ?? 'unknown image');
  }

  private loadRareAchievements(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);

    this.rareAchievementsService.getRareAchievements().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (dataset) => {
        this.dataset.set(dataset);
        this.lastEdited.set(this.parseDate(dataset.generatedAt));
        this.lastEditedTimeZoneLabel.set(this.getTimeZoneLabel(this.lastEdited()));

        if (!dataset.achievements.some((achievement) => achievement.id === this.selectedAchievementId())) {
          this.selectedAchievementId.set(undefined);
        }

        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load rare achievements:', error);
        this.dataset.set(null);
        this.lastEdited.set(undefined);
        this.lastEditedTimeZoneLabel.set('Local time');
        this.loadError.set('We could not load the rare achievement data right now. Please try again in a moment.');
        this.isLoading.set(false);
      }
    });
  }

  private findAchievement(achievementId: number | undefined): RareAchievementDefinition | undefined {
    if (achievementId === undefined) {
      return undefined;
    }

    return this.dataset()?.achievements.find((achievement) => achievement.id === achievementId);
  }

  private toAchievementId(value: string | number | undefined): number | undefined {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : undefined;
  }

  private toMatchingCharacterView(
    character: RareAchievementCharacter,
    achievementId: number
  ): RareAchievementMatchView | undefined {
    const achievement = this.findCharacterAchievement(character, achievementId);
    if (!achievement && !character.achievementIds.includes(achievementId)) {
      return undefined;
    }

    const obtainedAt = achievement?.obtainedAt;
    const obtainedAtSortValue = this.toTimestamp(obtainedAt);
    const faction = this.getFactionForRace(character.race);

    return {
      rank: 0,
      name: character.name,
      realm: character.realm,
      race: character.race,
      classId: character.class,
      guild: character.guild,
      faction,
      gender: DEFAULT_RACE_ICON_GENDER,
      raceIcon: getRaceIconPath(character.race, DEFAULT_RACE_ICON_GENDER),
      classIcon: getClassIconPath(character.class),
      obtainedAt,
      obtainedAtLabel: this.formatObtainedAt(obtainedAt),
      obtainedAtSortValue
    };
  }

  private findCharacterAchievement(
    character: RareAchievementCharacter,
    achievementId: number
  ): RareAchievementOwnership | undefined {
    return character.achievements.find((achievement) => achievement.id === achievementId);
  }

  private compareCharacters(left: RareAchievementMatchView, right: RareAchievementMatchView): number {
    if (left.obtainedAtSortValue !== undefined || right.obtainedAtSortValue !== undefined) {
      if (left.obtainedAtSortValue === undefined) {
        return 1;
      }

      if (right.obtainedAtSortValue === undefined) {
        return -1;
      }

      if (left.obtainedAtSortValue !== right.obtainedAtSortValue) {
        return right.obtainedAtSortValue - left.obtainedAtSortValue;
      }
    }

    const realmResult = left.realm.localeCompare(right.realm);
    if (realmResult !== 0) {
      return realmResult;
    }

    return left.name.localeCompare(right.name);
  }

  private parseDate(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private getTimeZoneLabel(date: Date | undefined): string {
    if (!date) {
      return 'Local time';
    }

    try {
      const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(date);
      return parts.find((part) => part.type === 'timeZoneName')?.value ?? 'Local time';
    } catch {
      return 'Local time';
    }
  }

  private formatObtainedAt(value: string | null | undefined): string {
    const date = this.parseDate(value ?? undefined);
    return date ? this.obtainedAtFormatter.format(date) : 'Unknown';
  }

  private toTimestamp(value: string | null | undefined): number | undefined {
    const date = this.parseDate(value ?? undefined);
    return date?.getTime();
  }

  private getFactionForRace(race: number): CharacterFaction {
    return ALLIANCE_RACE_IDS.has(race) ? 'Alliance' : 'Horde';
  }
}
