import { FilterDropdownOption } from './filter-dropdown.types';

export const R1_GLADIATOR_OPTIONS: ReadonlyArray<FilterDropdownOption<number>> = [
  { value: 8666, label: 'S15 - Prideful Gladiator' },
  { value: 8643, label: 'S14 - Grievous Gladiator' },
  { value: 8791, label: 'S13 - Tyrannical Gladiator' },
  { value: 8214, label: 'S12 - Malevolent Gladiator' },
  { value: 6938, label: 'S11 - Cataclysmic Gladiator' },
  { value: 6124, label: 'S10 - Ruthless Gladiator' },
  { value: 6002, label: 'S9 - Vicious Gladiator' },
  { value: 4599, label: 'S8 - Wrathful Gladiator' },
  { value: 3758, label: 'S7 - Relentless Gladiator' },
  { value: 3436, label: 'S6 - Furious Gladiator' },
  { value: 3336, label: 'S5 - Deadly Gladiator' },
  { value: 420, label: 'S3 - Brutal Gladiator' },
  { value: 419, label: 'S2 - Vengeful Gladiator' },
  { value: 418, label: 'S1 - Merciless Gladiator' }
];

export const GLADIATOR_MOUNT_OPTIONS: ReadonlyArray<FilterDropdownOption<number>> = [
  { value: 8707, label: "S15 - Prideful Gladiator's Cloud Serpent" },
  { value: 8705, label: "S14 - Grievous Gladiator's Cloud Serpent" },
  { value: 8678, label: "S13 - Tyrannical Gladiator's Cloud Serpent" },
  { value: 8216, label: "S12 - Malevolent Gladiator's Cloud Serpent" },
  { value: 6741, label: "S11 - Cataclysmic Gladiator's Twilight Drake" },
  { value: 6322, label: "S10 - Ruthless Gladiator's Twilight Drake" },
  { value: 6003, label: "S9 - Vicious Gladiator's Twilight Drake" },
  { value: 4600, label: "S8 - Wrathful Gladiator's Frost Wyrm" },
  { value: 3757, label: "S7 - Relentless Gladiator's Frost Wyrm" },
  { value: 3756, label: "S6 - Furious Gladiator's Frost Wyrm" },
  { value: 3096, label: "S5 - Deadly Gladiator's Frost Wyrm" },
  { value: 2316, label: 'S4 - Brutal Nether Drake' },
  { value: 888, label: 'S3 - Vengeful Nether Drake' },
  { value: 887, label: 'S2 - Merciless Nether Drake' },
  { value: 886, label: 'S1 - Swift Nether Drake' }
];

export const RATED_BATTLEGROUND_OPTIONS: ReadonlyArray<FilterDropdownOption<number>> = [
  { value: 8659, label: 'Hero of the Horde: Prideful' },
  { value: 8657, label: 'Hero of the Horde: Grievous' },
  { value: 8653, label: 'Hero of the Horde: Tyrannical' },
  { value: 8244, label: 'Hero of the Horde: Malevolent' },
  { value: 6940, label: 'Hero of the Horde: Cataclysmic' },
  { value: 6317, label: 'Hero of the Horde: Ruthless' },
  { value: 5358, label: 'Hero of the Horde: Vicious' },
  { value: 8658, label: 'Hero of the Alliance: Prideful' },
  { value: 8654, label: 'Hero of the Alliance: Grievous' },
  { value: 8652, label: 'Hero of the Alliance: Tyrannical' },
  { value: 8243, label: 'Hero of the Alliance: Malevolent' },
  { value: 6939, label: 'Hero of the Alliance: Cataclysmic' },
  { value: 6316, label: 'Hero of the Alliance: Ruthless' },
  { value: 5344, label: 'Hero of the Alliance: Vicious' }
];

export function buildRareAchievementCharacterKey(name: string, realm: string): string {
  return `${realm.trim().toLowerCase()}::${name.trim().toLowerCase()}`;
}

export function extractAchievementSeasonLabel(label: string): string | undefined {
  const match = /^((?:S)\d+)/i.exec(label.trim());
  return match?.[1]?.toUpperCase();
}
