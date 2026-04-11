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
  RareAchievementsDataset
} from './rare-achievements.types';
import { UpdateBarComponent } from './update-bar.component';
import { getArmoryUrl } from '../utils/armory';

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
  readonly matchingCharacters = computed(() => {
    const achievementId = this.selectedAchievementId();
    if (achievementId === undefined) {
      return [];
    }

    return [...(this.dataset()?.characters ?? [])]
      .filter((character) => character.achievementIds.includes(achievementId))
      .sort((left, right) => this.compareCharacters(left, right));
  });
  readonly matchCount = computed(() => this.matchingCharacters().length);
  readonly hasSelection = computed(() => this.selectedAchievementId() !== undefined);
  readonly hasMatches = computed(() => this.matchCount() > 0);
  readonly showSelectionPrompt = computed(() => !this.isLoading() && !this.loadError() && !this.hasSelection());
  readonly showEmptyState = computed(() => !this.isLoading() && !this.loadError() && this.hasSelection() && !this.hasMatches());

  readonly getArmoryUrl = getArmoryUrl;

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

  trackCharacter(_index: number, character: RareAchievementCharacter): string {
    return `${character.realm}::${character.name}`;
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

  private compareCharacters(left: RareAchievementCharacter, right: RareAchievementCharacter): number {
    const nameResult = left.name.localeCompare(right.name);
    if (nameResult !== 0) {
      return nameResult;
    }

    return left.realm.localeCompare(right.realm);
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
}
