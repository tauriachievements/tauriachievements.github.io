import { Params } from '@angular/router';

export interface SearchSuggestion {
  key: string;
  link: readonly (string | number)[];
  queryParams?: Params;
  name: string;
  color?: string;
  icon?: string;
  iconLabel?: string;
  mark?: string;
  detail: string;
  rank?: number;
  value: string;
  valueColor?: string;
}

export function foldName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function searchByName<T>(
  items: readonly T[],
  query: string,
  limit: number,
  foldedName: (item: T) => string | undefined
): T[] {
  const needle = foldName(query.trim());
  if (!needle) {
    return [];
  }

  const starts: T[] = [];
  const contains: T[] = [];
  for (const item of items) {
    if (starts.length >= limit) {
      break;
    }

    const at = foldedName(item)?.indexOf(needle) ?? -1;
    if (at === 0) {
      starts.push(item);
    } else if (at > 0 && contains.length < limit) {
      contains.push(item);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}
