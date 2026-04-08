import { LadderSelectOption } from './ladder-options';

export const GUILD_SOURCE_LIMIT_OPTIONS: ReadonlyArray<LadderSelectOption<number>> = [
  { value: 100, label: 'Top 100' },
  { value: 500, label: 'Top 500' },
  { value: 1000, label: 'Top 1000' }
];

export const GUILD_DISPLAY_LIMIT_OPTIONS: ReadonlyArray<LadderSelectOption<number>> = [
  { value: 10, label: 'Top 10' },
  { value: 50, label: 'Top 50' },
  { value: 100, label: 'Top 100' }
];
