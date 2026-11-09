import { Signal, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { injectReplaceUrl } from '../../core/url-state';
import { MythicPlusIndex, archivedSeasonId, seasonParam } from './mythic-plus';
import { MythicPlusDataService } from './mythic-plus-data.service';

export interface MythicPlusSeasonSelection {
  readonly selected: Signal<string | undefined>;
  select(seasonId: string | undefined, index: MythicPlusIndex | undefined): boolean;
  loaded(index: MythicPlusIndex): void;
}

export function injectSeasonSelection(): MythicPlusSeasonSelection {
  const data = inject(MythicPlusDataService);
  const replaceUrl = injectReplaceUrl();
  const requested = inject(ActivatedRoute).snapshot.queryParamMap.get('season');
  if (requested !== null) {
    data.selectedSeason.set(requested || undefined);
  }
  let addressChecked = false;

  return {
    selected: data.selectedSeason.asReadonly(),
    select(seasonId, index) {
      const next = index ? archivedSeasonId(index, seasonId) : seasonId;
      const changed = next !== data.selectedSeason();
      data.selectedSeason.set(next);
      return changed;
    },
    loaded(index) {
      const shown = seasonParam(index);
      data.selectedSeason.set(shown);
      if (!addressChecked && (requested || undefined) !== shown) {
        replaceUrl({ season: shown ?? null }, { merge: true });
      }
      addressChecked = true;
    }
  };
}
