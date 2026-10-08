import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { SeenExport, parseCharacterKey, parseSeenExport, safeStorage } from '../mythic-plus-movement';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Where the visitor's Mythic+ choices are kept. Reading `localStorage` itself can throw, hence a getter. */
export const MYTHIC_PLUS_STORAGE = new InjectionToken<() => StorageLike | null | undefined>('MYTHIC_PLUS_STORAGE', {
  providedIn: 'root',
  factory: () => () => globalThis.localStorage
});

const ME_KEY = 'mythicPlus.me';
const SEEN_KEY = 'mythicPlus.seenExport';

/**
 * What this browser remembers about its Mythic+ visitor: the character they said is theirs, and
 * the last export they saw. Kept in localStorage when it works and in memory when it doesn't,
 * so "This is me" still works for the rest of the visit in a private window.
 */
@Injectable({ providedIn: 'root' })
export class MythicPlusVisitorService {
  private readonly storage = safeStorage(inject(MYTHIC_PLUS_STORAGE));
  private readonly me = signal(validKey(this.storage.get(ME_KEY)));
  private seenInMemory?: SeenExport;

  /** `characterKey` of the visitor's own character, if they picked one. */
  readonly meKey = this.me.asReadonly();

  setMe(key: string | undefined): void {
    const valid = validKey(key);
    this.me.set(valid);
    if (valid) {
      this.storage.set(ME_KEY, valid);
    } else {
      this.storage.remove(ME_KEY);
    }
  }

  /** Saves `key` as the visitor's character, or forgets it when it already is. */
  toggleMe(key: string): void {
    this.setMe(this.me() === key ? undefined : key);
  }

  seenExport(): SeenExport | undefined {
    return parseSeenExport(this.storage.get(SEEN_KEY)) ?? this.seenInMemory;
  }

  markSeen(seen: SeenExport): void {
    this.seenInMemory = seen;
    this.storage.set(SEEN_KEY, JSON.stringify(seen));
  }
}

function validKey(key: string | undefined): string | undefined {
  return parseCharacterKey(key) ? key : undefined;
}
