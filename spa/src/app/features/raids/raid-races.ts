export interface RaceBoss {
  readonly key: string;
  readonly name: string;
  readonly iconUrl: string;
}

export type RaceTheme = 'nightmare' | 'valor';

export interface RaidRace {
  readonly name: string;
  readonly theme: RaceTheme;
  readonly dataFile: string;
  readonly bannerUrl: string;
  readonly backdropUrl?: string;
  readonly bannerOffset?: number;
  readonly loadingText: string;
  readonly bosses: readonly RaceBoss[];
  readonly startHour: number;
  readonly endHour: number;
  readonly timelineExcludedGuilds: readonly string[];
}

export const EMERALD_NIGHTMARE_RACE: RaidRace = {
  name: 'Emerald Nightmare',
  theme: 'nightmare',
  dataFile: 'EmeraldNightmare.json',
  bannerUrl: 'assets/emerald-nightmare-the-race-to.png',
  backdropUrl: 'https://www.buffed.de/screenshots/1280x/2016/09/WoW-Smaragdgruener-Alptraum-buffed.jpg',
  loadingText: 'The Nightmare is taking shape...',
  bosses: [
    { key: 'nythendra', name: 'Nythendra', iconUrl: 'assets/emerald-nightmare/01-nythendra.png' },
    { key: 'ursoc', name: 'Ursoc', iconUrl: 'assets/emerald-nightmare/04-ursoc.png' },
    { key: 'dragons-of-nightmare', name: 'Dragons', iconUrl: 'assets/emerald-nightmare/05-dragons-of-nightmare.png' },
    { key: 'elerethe-renferal', name: 'Elerethe', iconUrl: 'assets/emerald-nightmare/03-elerethe.png' },
    { key: 'ilgynoth', name: "Il'gynoth", iconUrl: "assets/emerald-nightmare/02-il'gunoth.png" },
    { key: 'cenarius', name: 'Cenarius', iconUrl: 'assets/emerald-nightmare/06-cenarius.png' },
    { key: 'xavius', name: 'Xavius', iconUrl: 'assets/emerald-nightmare/07-xavious.png' }
  ],
  startHour: 18,
  endHour: 22,
  timelineExcludedGuilds: ['cara máxima', 'nfa']
};

export const TRIAL_OF_VALOR_RACE: RaidRace = {
  name: 'Trial of Valor',
  theme: 'valor',
  dataFile: 'TrialOfValor.json',
  bannerUrl: 'assets/trial-of-valor-the-race-to.webp',
  bannerOffset: 10,
  loadingText: 'The Valarjar are gathering...',
  bosses: [
    { key: 'odyn', name: 'Odyn', iconUrl: 'assets/trial-of-valor/01-odyn.png' },
    { key: 'guarm', name: 'Guarm', iconUrl: 'assets/trial-of-valor/02-guarm.png' },
    { key: 'helya', name: 'Helya', iconUrl: 'assets/trial-of-valor/03-helya.png' }
  ],
  startHour: 18,
  endHour: 22,
  timelineExcludedGuilds: []
};
