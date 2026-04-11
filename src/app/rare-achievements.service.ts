import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import {
  GLADIATOR_MOUNT_OPTIONS,
  R1_GLADIATOR_OPTIONS,
  RATED_BATTLEGROUND_OPTIONS,
  buildRareAchievementCharacterKey,
  extractAchievementSeasonLabel
} from './rare-achievement-groups';
import {
  RareAchievementCharacter,
  RareAchievementMarker,
  RareAchievementMarkerType,
  RareAchievementSummary,
  RareAchievementsDataset
} from './rare-achievements.types';

interface RareAchievementMarkerDefinition {
  id: number;
  type: RareAchievementMarkerType;
  fullLabel: string;
  shortLabel: string;
  ariaLabel: string;
}

const GLADIATOR_TITLE_MARKERS: ReadonlyArray<RareAchievementMarkerDefinition> = R1_GLADIATOR_OPTIONS.map((option) =>
  createRareAchievementMarkerDefinition(option.value, 'gladiatorTitle', option.label)
);

const GLADIATOR_MOUNT_MARKERS: ReadonlyArray<RareAchievementMarkerDefinition> = GLADIATOR_MOUNT_OPTIONS.map((option) =>
  createRareAchievementMarkerDefinition(option.value, 'gladiatorMount', option.label)
);

const RATED_BATTLEGROUND_HERO_IDS = new Set<number>(RATED_BATTLEGROUND_OPTIONS.map((option) => option.value));

@Injectable({ providedIn: 'root' })
export class RareAchievementsService {
  private readonly http = inject(HttpClient);
  private rareAchievementIndicators$?: Observable<Map<string, RareAchievementSummary>>;

  getRareAchievements(): Observable<RareAchievementsDataset> {
    return this.http.get<RareAchievementsDataset>(`RareAchievements.json?v=${Date.now()}`);
  }

  getRareAchievementIndicators(): Observable<Map<string, RareAchievementSummary>> {
    if (!this.rareAchievementIndicators$) {
      this.rareAchievementIndicators$ = this.getRareAchievements().pipe(
        map((dataset) => this.buildRareAchievementIndicators(dataset)),
        catchError((error) => {
          this.rareAchievementIndicators$ = undefined;
          return throwError(() => error);
        }),
        shareReplay(1)
      );
    }

    return this.rareAchievementIndicators$;
  }

  private buildRareAchievementIndicators(dataset: RareAchievementsDataset): Map<string, RareAchievementSummary> {
    const indicators = new Map<string, RareAchievementSummary>();

    for (const character of dataset.characters ?? []) {
      const summary = this.toRareAchievementSummary(character);

      if (!summary) {
        continue;
      }

      indicators.set(buildRareAchievementCharacterKey(character.name, character.realm), summary);
    }

    return indicators;
  }

  private toRareAchievementSummary(character: RareAchievementCharacter): RareAchievementSummary | undefined {
    const ownedAchievementIds = new Set(character.achievements.map((achievement) => achievement.id));
    const titleMarkers = this.collectMarkers(ownedAchievementIds, GLADIATOR_TITLE_MARKERS);
    const mountMarkers = this.collectMarkers(ownedAchievementIds, GLADIATOR_MOUNT_MARKERS);
    const ratedBattlegroundHeroCount = this.countOwnedAchievements(ownedAchievementIds, RATED_BATTLEGROUND_HERO_IDS);

    if (titleMarkers.length === 0 && mountMarkers.length === 0 && ratedBattlegroundHeroCount === 0) {
      return undefined;
    }

    return {
      gladiatorTitleCount: titleMarkers.length,
      gladiatorMountCount: mountMarkers.length,
      ratedBattlegroundHeroCount,
      markers: [...titleMarkers, ...mountMarkers]
    };
  }

  private collectMarkers(
    ownedAchievementIds: ReadonlySet<number>,
    definitions: ReadonlyArray<RareAchievementMarkerDefinition>
  ): RareAchievementMarker[] {
    return definitions
      .filter((definition) => ownedAchievementIds.has(definition.id))
      .map((definition) => ({
        key: `${definition.type}-${definition.id}`,
        type: definition.type,
        shortLabel: definition.shortLabel,
        fullLabel: definition.fullLabel,
        ariaLabel: definition.ariaLabel
      }));
  }

  private countOwnedAchievements(ownedAchievementIds: ReadonlySet<number>, trackedAchievementIds: ReadonlySet<number>): number {
    let count = 0;

    for (const achievementId of trackedAchievementIds) {
      if (ownedAchievementIds.has(achievementId)) {
        count++;
      }
    }

    return count;
  }
}

function createRareAchievementMarkerDefinition(
  id: number,
  type: RareAchievementMarkerType,
  label: string
): RareAchievementMarkerDefinition {
  const seasonLabel = extractAchievementSeasonLabel(label);
  const shortLabel = seasonLabel ?? 'S';
  const markerTypeLabel = type === 'gladiatorTitle' ? 'Gladiator title' : 'Gladiator mount';

  return {
    id,
    type,
    fullLabel: label,
    shortLabel,
    ariaLabel: `${markerTypeLabel}: ${label}`
  };
}
