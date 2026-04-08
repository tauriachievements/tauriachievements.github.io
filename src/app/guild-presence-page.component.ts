import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { BackToTopButtonComponent } from './back-to-top-button.component';
import { GuildPresencePageStore } from './guild-presence-page.store';
import { GuildPresenceRankingEntry } from './guild-presence.types';
import { UpdateBarComponent } from './update-bar.component';
import { getGuildArmoryUrl } from '../utils/armory';

const DISPLAY_LIMIT = 50;

@Component({
  selector: 'app-guild-presence-page',
  templateUrl: './guild-presence-page.component.html',
  styleUrls: ['./guild-presence-page.component.scss'],
  standalone: true,
  imports: [CommonModule, UpdateBarComponent, BackToTopButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GuildPresencePageStore]
})
export class GuildPresencePageComponent implements OnInit {
  private readonly guildPresencePageStore = inject(GuildPresencePageStore);

  readonly guildPresence = this.guildPresencePageStore.guildPresence;
  readonly isLoading = this.guildPresencePageStore.isLoading;
  readonly syncMessage = this.guildPresencePageStore.syncMessage;
  readonly loadError = this.guildPresencePageStore.loadError;
  readonly lastEdited = this.guildPresencePageStore.lastEdited;
  readonly lastEditedTimeZoneLabel = this.guildPresencePageStore.lastEditedTimeZoneLabel;
  readonly hasSourcePlayers = this.guildPresencePageStore.hasSourcePlayers;
  readonly allAchievementGuilds = computed(() => this.guildPresence()?.achievementGuilds ?? []);
  readonly allHonorableKillGuilds = computed(() => this.guildPresence()?.honorableKillGuilds ?? []);
  readonly achievementGuilds = computed(() => this.allAchievementGuilds().slice(0, DISPLAY_LIMIT));
  readonly honorableKillGuilds = computed(() => this.allHonorableKillGuilds().slice(0, DISPLAY_LIMIT));
  readonly achievementLeaderboardSize = computed(() => this.guildPresence()?.achievementLeaderboardSize ?? 0);
  readonly honorableKillLeaderboardSize = computed(() => this.guildPresence()?.honorableKillLeaderboardSize ?? 0);
  readonly achievementShownCount = computed(() => this.achievementGuilds().length);
  readonly honorableKillShownCount = computed(() => this.honorableKillGuilds().length);
  readonly showLoadingState = computed(() => this.isLoading() && !this.hasSourcePlayers());
  readonly showErrorState = computed(() => !this.isLoading() && !!this.loadError() && !this.hasSourcePlayers());
  readonly hasGuildRankings = computed(() => this.achievementGuilds().length > 0 || this.honorableKillGuilds().length > 0);
  readonly showEmptyState = computed(() => !this.showLoadingState() && !this.showErrorState() && !this.hasGuildRankings());
  readonly showRefreshingBanner = computed(() => this.isLoading() && this.hasSourcePlayers());
  readonly showErrorBanner = computed(() => !!this.loadError() && this.hasSourcePlayers());

  readonly getGuildArmoryUrl = getGuildArmoryUrl;

  ngOnInit(): void {
    this.guildPresencePageStore.initialize();
  }

  syncData(): void {
    void this.guildPresencePageStore.syncData();
  }

  trackGuild(_index: number, guild: GuildPresenceRankingEntry): string {
    return guild.key;
  }
}
