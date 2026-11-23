import { describe, expect, it } from 'vitest';
import { MythicPlusMember } from './mythic-plus';
import { RUN_VIDEOS, RunVideo, runVideoUrl } from './mythic-plus-videos';

function member(name: string): MythicPlusMember {
  return { name, realm: 'Evermoon', class: 1, race: 1, gender: 0, spec: 'Arms', role: 'dps' };
}

const video: RunVideo = {
  dungeon: 'cos',
  player: 'Pretz',
  completedAt: '2026-11-23T01:15Z',
  url: 'https://www.youtube.com/watch?v=b5DZMFugfXY'
};

const run = {
  dungeon: 'cos',
  completedAt: '2026-11-23T01:15:35.000Z',
  roster: [member('Chekic'), member('Pretz'), member('Yodadru')]
};

describe('runVideoUrl', () => {
  it('finds the video of a run by its dungeon, a player of its group and the minute it finished', () => {
    expect(runVideoUrl(run, [video])).toBe('https://www.youtube.com/watch?v=b5DZMFugfXY');
  });

  it('matches a finish time written to the second as well', () => {
    expect(runVideoUrl(run, [{ ...video, completedAt: '2026-11-23T01:15:35Z' }])).toBe(video.url);
  });

  it('tells apart two runs of the player stamped in the same minute by a finish time written to the second', () => {
    const exact = { ...video, completedAt: '2026-11-23T01:15:35Z' };

    expect(runVideoUrl({ ...run, completedAt: '2026-11-23T01:15:22.000Z' }, [exact])).toBeUndefined();
    expect(runVideoUrl(run, [exact])).toBe(video.url);
  });

  it('matches the player name in any case', () => {
    expect(runVideoUrl(run, [{ ...video, player: 'pretz' }])).toBe(video.url);
  });

  it('gives no video to a run of another dungeon, another group or another minute', () => {
    expect(runVideoUrl({ ...run, dungeon: 'arc' }, [video])).toBeUndefined();
    expect(runVideoUrl({ ...run, roster: [member('Chekic'), member('Yodadru')] }, [video])).toBeUndefined();
    expect(runVideoUrl({ ...run, completedAt: '2026-11-23T01:16:02.000Z' }, [video])).toBeUndefined();
  });

  it('gives no video when none is listed', () => {
    expect(runVideoUrl(run, [])).toBeUndefined();
  });
});

describe('RUN_VIDEOS', () => {
  it('lists every video with a dungeon, a player, a UTC finish time and an https link', () => {
    for (const entry of RUN_VIDEOS) {
      expect(entry.dungeon).toMatch(/^[a-z]+$/);
      expect(entry.player.trim()).not.toBe('');
      expect(entry.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/);
      expect(Number.isNaN(Date.parse(entry.completedAt))).toBe(false);
      expect(entry.url).toMatch(/^https:\/\//);
    }
  });
});
