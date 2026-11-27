import { RatedBgRosterEntry, RatedBgRosterFile, RosterPlayer, rosterPlayers } from './rated-bg-picker';

export function entry(name: string, overrides: Partial<RatedBgRosterEntry> = {}): RatedBgRosterEntry {
  return { name, realm: 'Evermoon', race: 1, gender: 0, class: 1, spec: 'Arms', traits: 40, itemLevel: 885, ...overrides };
}

export function roster(players: RatedBgRosterEntry[], version = 1): RatedBgRosterFile {
  return { version, generatedAt: '2026-11-24T12:29:26Z', players };
}

export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function tickedEntries(healers: number, ranged: number, melee: number): RatedBgRosterEntry[] {
  return [
    ...Array.from({ length: healers }, (_, index) => entry(`Healer${index}`, { class: 5, spec: 'Holy' })),
    ...Array.from({ length: ranged }, (_, index) => entry(`Ranged${index}`, { class: 8, spec: 'Fire' })),
    ...Array.from({ length: melee }, (_, index) => entry(`Melee${index}`))
  ];
}

export function ticked(healers: number, ranged: number, melee: number): RosterPlayer[] {
  return rosterPlayers(roster(tickedEntries(healers, ranged, melee)));
}
