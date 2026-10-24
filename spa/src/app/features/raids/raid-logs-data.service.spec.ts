import { TestBed } from '@angular/core/testing';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { RaidLogsDataService } from './raid-logs-data.service';
import { RaidLogsIndexFile } from './raid-logs.types';
import { bossFile, indexFile } from './raid-logs.fixture';
import { DataFileService } from '../../core/data-file.service';

const flagged: RaidLogsIndexFile = { ...indexFile, invalidLogs: [['Tauri', 11, 'Invalid log, bug abusing']] };

class FakeDataFiles {
  fetchJson<T>(path: string): Observable<T> {
    if (path === 'raid-log-data/index.json') {
      return of(flagged as T);
    }
    return path === 'raid-log-data/nythendra-mythic.json' ? of(bossFile as T) : throwError(() => new Error(`No ${path}`));
  }

  refresh(): void {}
}

function service(): RaidLogsDataService {
  TestBed.configureTestingModule({ providers: [{ provide: DataFileService, useValue: new FakeDataFiles() }] });
  return TestBed.inject(RaidLogsDataService);
}

describe('RaidLogsDataService with an invalid log', () => {
  it('leaves the invalid kill out of the boss kills and gives it apart', async () => {
    const data = service();
    const index = await firstValueFrom(data.index());
    const [nythendra] = index.bosses;
    const mythic = index.difficulties[2];

    expect((await firstValueFrom(data.bossKills(index, nythendra, mythic))).map(kill => kill.logId)).toEqual([10]);
    expect((await firstValueFrom(data.difficultyKills(index, mythic))).map(kill => kill.logId)).toEqual([10]);
    expect((await firstValueFrom(data.invalidBossKills(index, nythendra, mythic))).map(kill => [kill.logId, kill.invalid]))
      .toEqual([[11, 'Invalid log, bug abusing']]);
  });

  it('still finds the invalid log, marked with its reason', async () => {
    const found = await firstValueFrom(service().findKill('tauri', 11));

    expect(found.kill?.invalid).toBe('Invalid log, bug abusing');
    expect(found.details).toMatchObject({ logId: 11, invalid: 'Invalid log, bug abusing' });
    expect(found.details?.members).toHaveLength(3);
  });
});
