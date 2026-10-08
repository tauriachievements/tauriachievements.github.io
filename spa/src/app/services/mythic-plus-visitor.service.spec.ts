import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MYTHIC_PLUS_STORAGE, MythicPlusVisitorService } from './mythic-plus-visitor.service';

/** A localStorage stand-in; `values` survives across service instances like a real browser's. */
function memoryStorage(values = new Map<string, string>()) {
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key)
  };
}

function createService(storage: () => ReturnType<typeof memoryStorage> | undefined): MythicPlusVisitorService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: MYTHIC_PLUS_STORAGE, useValue: storage }] });
  return TestBed.inject(MythicPlusVisitorService);
}

const blocked = () => {
  throw new DOMException('The operation is insecure.', 'SecurityError');
};

describe('MythicPlusVisitorService', () => {
  it('remembers the saved character across visits', () => {
    const storage = memoryStorage();
    createService(() => storage).setMe('Progtrix|Evermoon');

    expect(storage.values.get('mythicPlus.me')).toBe('Progtrix|Evermoon');
    expect(createService(() => storage).meKey()).toBe('Progtrix|Evermoon');
  });

  it('forgets the character when toggled again, and saves another in its place', () => {
    const storage = memoryStorage();
    const visitor = createService(() => storage);

    visitor.toggleMe('Progtrix|Evermoon');
    visitor.toggleMe('Napim|Tauri');
    expect(visitor.meKey()).toBe('Napim|Tauri');

    visitor.toggleMe('Napim|Tauri');
    expect(visitor.meKey()).toBeUndefined();
    expect(storage.values.has('mythicPlus.me')).toBe(false);
  });

  it('ignores a broken stored character', () => {
    const storage = memoryStorage(new Map([['mythicPlus.me', 'no-realm-here']]));
    expect(createService(() => storage).meKey()).toBeUndefined();
  });

  it('keeps working in memory when storage is blocked', () => {
    const visitor = createService(blocked);
    const seen = { season: 'legion-s1', generatedAt: '2026-10-08T13:00:00Z' };

    expect(visitor.meKey()).toBeUndefined();
    visitor.toggleMe('Progtrix|Evermoon');
    expect(visitor.meKey()).toBe('Progtrix|Evermoon');

    expect(visitor.seenExport()).toBeUndefined();
    visitor.markSeen(seen);
    expect(visitor.seenExport()).toEqual(seen);
  });

  it('stores the last seen export', () => {
    const storage = memoryStorage();
    const seen = { season: 'legion-s1', generatedAt: '2026-10-08T13:00:00Z' };
    createService(() => storage).markSeen(seen);

    expect(createService(() => storage).seenExport()).toEqual(seen);
  });
});
