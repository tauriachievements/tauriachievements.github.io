import { Params } from '@angular/router';

export interface NavPage {
  readonly label: string;
  readonly tab?: string;
  readonly path: string;
  readonly queryParams?: Params;
  readonly includes?: readonly string[];
  readonly tag?: string;
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly pages: readonly NavPage[];
}

export interface NavSection {
  readonly id: string;
  readonly label: string;
  readonly isNew?: boolean;
  readonly pages: readonly NavPage[];
  readonly groups?: readonly NavGroup[];
}

export const DISCORD_INVITE_URL = 'https://discord.gg/JMHnDmh2bP';

export interface NavLocation {
  readonly section: NavSection;
  readonly group?: NavGroup;
  readonly page: NavPage;
}

function groupedSection(section: Omit<NavSection, 'pages' | 'groups'> & { readonly groups: readonly NavGroup[] }): NavSection {
  return { ...section, pages: section.groups.flatMap((group) => group.pages) };
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    id: 'ladder',
    label: 'Ladder',
    pages: [
      { label: 'Players', path: '/' },
      { label: 'Top Gainers', tab: 'Movers', path: '/top-gainers' },
      { label: 'Compare', path: '/compare' },
      { label: 'Guild Rankings', tab: 'Guilds', path: '/guilds' }
    ]
  },
  {
    id: 'achievements',
    label: 'Achievements',
    pages: [
      { label: 'Rare Achievements', tab: 'Browse', path: '/rare-achievements' },
      { label: 'New Rare Characters', tab: 'New Discoveries', path: '/new-rare-characters' },
      { label: 'Hall of Fame', path: '/ap-chest-looters', tag: 'Archive' }
    ]
  },
  {
    id: 'pvp',
    label: 'PvP',
    pages: [
      { label: 'Arena', path: '/arena' },
      { label: 'Arena Statistics', tab: 'Arena Stats', path: '/arena/stats' },
      { label: 'Battlegrounds', tab: 'BG Activity', path: '/battleground' },
      { label: 'Rated Battlegrounds', tab: 'Rated BG', path: '/rated-battleground' }
    ]
  },
  groupedSection({
    id: 'raids',
    label: 'Raids',
    groups: [
      {
        id: 'raid-logs-rankings',
        label: 'Logs & Rankings',
        pages: [
          {
            label: 'Raid Logs',
            tab: 'Logs',
            path: '/raid-logs',
            includes: ['/raid-logs/boss', '/raid-logs/log', '/raid-logs/invalid']
          },
          {
            label: 'Guild Progression',
            tab: 'Guilds',
            path: '/raid-logs/guilds',
            includes: ['/raid-logs/guild']
          },
          { label: 'Fastest Clears', tab: 'Clears', path: '/raid-logs/clears' },
          {
            label: 'Character Rankings',
            tab: 'Rankings',
            path: '/raid-logs/leaderboard',
            includes: ['/raid-logs/character']
          }
        ]
      },
      {
        id: 'raid-analytics',
        label: 'Analytics',
        pages: [
          {
            label: 'Raid Statistics',
            tab: 'Statistics',
            path: '/raid-logs/stats',
            queryParams: { difficulty: 'mythic' }
          },
          { label: 'Tier List', path: '/raid-logs/tier-list', queryParams: { difficulty: 'mythic' } },
          {
            label: 'Talent Analytics',
            tab: 'Talents',
            path: '/raid-logs/talents',
            queryParams: { difficulty: 'mythic' }
          },
          {
            label: 'Trinket Analytics',
            tab: 'Trinkets',
            path: '/raid-logs/trinkets',
            queryParams: { difficulty: 'mythic' }
          }
        ]
      },
      {
        id: 'raid-races',
        label: 'Realm First Race',
        pages: [
          { label: 'Race to Emerald Nightmare', tab: 'EN Race', path: '/emerald-nightmare' },
          { label: 'Race to Trial of Valor', tab: 'ToV Race', path: '/trial-of-valor' },
          { label: 'Realm First History', tab: 'History', path: '/raid-history' }
        ]
      }
    ]
  }),
  {
    id: 'mythic-plus',
    label: 'Mythic+',
    pages: [
      {
        label: 'Leaderboard',
        path: '/mythic-plus',
        includes: ['/mythic-plus/character', '/mythic-plus/guild', '/mythic-plus/scoring']
      },
      { label: 'Statistics', tab: 'Activity', path: '/mythic-plus/stats' },
      { label: 'Records', path: '/mythic-plus/records' },
      { label: 'Addon', path: '/legion-key-history-addon' }
    ]
  },
  {
    id: 'realm-stats',
    label: 'Realm Stats',
    pages: [
      { label: 'Realm Stats', path: '/stats' }
    ]
  }
];

export function findNavLocation(url: string, sections: readonly NavSection[] = NAV_SECTIONS): NavLocation | undefined {
  const path = url.split(/[?#;]/, 1)[0].replace(/\/+$/, '') || '/';

  for (const section of sections) {
    for (const page of section.pages) {
      const isIncluded = page.includes?.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (path === page.path || isIncluded) {
        return { section, group: section.groups?.find((group) => group.pages.includes(page)), page };
      }
    }
  }

  return undefined;
}
