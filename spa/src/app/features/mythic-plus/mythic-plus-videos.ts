import { MythicPlusRun } from './mythic-plus';

export interface RunVideo {
  readonly dungeon: string;
  readonly player: string;
  readonly completedAt: string;
  readonly url: string;
}

export const RUN_VIDEOS: readonly RunVideo[] = [
  { dungeon: 'cos', player: 'Pretz', completedAt: '2026-11-23T01:15Z', url: 'https://www.youtube.com/watch?v=b5DZMFugfXY' },
  { dungeon: 'mos', player: 'Pretz', completedAt: '2026-11-19T22:53Z', url: 'https://www.youtube.com/watch?v=n0PQ-sr0RD8' },
  { dungeon: 'nl', player: 'Pretz', completedAt: '2026-11-20T02:10Z', url: 'https://www.youtube.com/watch?v=4klMTmePnoQ' },
  { dungeon: 'brh', player: 'Pretz', completedAt: '2026-11-11T01:59Z', url: 'https://www.youtube.com/watch?v=_RHX3SeL8is' }
];

export const VIDEO_ICON_PATH =
  'M4.5 5.5h9A2.5 2.5 0 0 1 16 8v8a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 2 16V8a2.5 2.5 0 0 1 2.5-2.5z'
  + 'M17.5 10.2l3.7-2.6A.8.8 0 0 1 22.5 8.3v7.4a.8.8 0 0 1-1.3.7l-3.7-2.6z';

const MINUTE_MS = 60_000;

function finishMinute(completedAt: string): number {
  return Math.floor(Date.parse(completedAt) / MINUTE_MS);
}

export function runVideoUrl(
  run: Pick<MythicPlusRun, 'dungeon' | 'completedAt' | 'roster'>,
  videos: readonly RunVideo[] = RUN_VIDEOS
): string | undefined {
  const minute = finishMinute(run.completedAt);
  const names = new Set(run.roster.map(member => member.name.toLowerCase()));

  return videos.find(video => video.dungeon === run.dungeon
    && finishMinute(video.completedAt) === minute
    && names.has(video.player.toLowerCase()))?.url;
}
