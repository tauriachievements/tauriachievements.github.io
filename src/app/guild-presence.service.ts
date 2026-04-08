import { Injectable } from '@angular/core';
import { Observable, combineLatest, map } from 'rxjs';
import { LadderAchievement, LadderService } from './ladder.service';
import { GuildPresenceData, GuildPresenceFaction, GuildPresenceMetric, GuildPresenceRankingEntry } from './guild-presence.types';

export const GUILD_PRESENCE_LIMIT = 1000;

interface GuildPresenceAccumulator {
  key: string;
  guild: string;
  realm: string;
  playerCount: number;
  metricTotal: number;
  topMemberName: string;
  topMemberMetricValue: number;
  factions: Set<'Alliance' | 'Horde'>;
}

@Injectable({ providedIn: 'root' })
export class GuildPresenceService {
  constructor(private readonly ladderService: LadderService) {}

  getGuildPresence(limit: number = GUILD_PRESENCE_LIMIT): Observable<GuildPresenceData> {
    return combineLatest([
      this.ladderService.getAchievements(undefined, undefined, undefined, undefined, 1, limit),
      this.ladderService.getHonorableKills(undefined, undefined, undefined, undefined, 1, limit)
    ]).pipe(
      map(([achievementPlayers, honorableKillPlayers]) => ({
        achievementLeaderboardSize: achievementPlayers.length,
        honorableKillLeaderboardSize: honorableKillPlayers.length,
        achievementGuilds: this.buildGuildRanking(achievementPlayers, 'achievementPoints'),
        honorableKillGuilds: this.buildGuildRanking(honorableKillPlayers, 'honorableKills')
      }))
    );
  }

  private buildGuildRanking(
    players: readonly LadderAchievement[],
    metric: GuildPresenceMetric
  ): GuildPresenceRankingEntry[] {
    const guilds = new Map<string, GuildPresenceAccumulator>();

    for (const player of players) {
      const guildName = player.guild.trim();
      if (!guildName) {
        continue;
      }

      const key = `${player.realm}::${guildName}`;
      const metricValue = metric === 'achievementPoints'
        ? player.achievementPoints
        : player.honorableKills;
      const existing = guilds.get(key) ?? {
        key,
        guild: guildName,
        realm: player.realm,
        playerCount: 0,
        metricTotal: 0,
        topMemberName: player.name,
        topMemberMetricValue: metricValue,
        factions: new Set<'Alliance' | 'Horde'>()
      };

      existing.playerCount += 1;
      existing.metricTotal += metricValue;

      if (metricValue > existing.topMemberMetricValue
        || (metricValue === existing.topMemberMetricValue
          && player.name.localeCompare(existing.topMemberName) < 0)) {
        existing.topMemberName = player.name;
        existing.topMemberMetricValue = metricValue;
      }

      const faction = this.normalizeFaction(player.faction);
      if (faction !== 'Mixed') {
        existing.factions.add(faction);
      }

      guilds.set(key, existing);
    }

    const leaderboardSize = players.length;

    return Array.from(guilds.values())
      .sort((left, right) => this.compareGuildPresence(left, right))
      .map((guild, index) => ({
        rank: index + 1,
        key: guild.key,
        guild: guild.guild,
        realm: guild.realm,
        faction: this.getGuildFaction(guild.factions),
        playerCount: guild.playerCount,
        shareOfLeaderboard: leaderboardSize > 0 ? guild.playerCount / leaderboardSize : 0,
        metricTotal: guild.metricTotal,
        topMemberName: guild.topMemberName,
        topMemberMetricValue: guild.topMemberMetricValue
      }));
  }

  private compareGuildPresence(left: GuildPresenceAccumulator, right: GuildPresenceAccumulator): number {
    if (right.playerCount !== left.playerCount) {
      return right.playerCount - left.playerCount;
    }

    if (right.metricTotal !== left.metricTotal) {
      return right.metricTotal - left.metricTotal;
    }

    if (right.topMemberMetricValue !== left.topMemberMetricValue) {
      return right.topMemberMetricValue - left.topMemberMetricValue;
    }

    return left.key.localeCompare(right.key);
  }

  private normalizeFaction(value: string): GuildPresenceFaction {
    if (value === 'Alliance' || value === 'Horde') {
      return value;
    }

    return 'Mixed';
  }

  private getGuildFaction(factions: Set<'Alliance' | 'Horde'>): GuildPresenceFaction {
    if (factions.size === 1) {
      return factions.has('Alliance') ? 'Alliance' : 'Horde';
    }

    return 'Mixed';
  }
}
