import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RaidTrinket } from './raid-logs.types';
import { RaidTrinketIconsComponent } from './raid-trinket-icons.component';

const CHRONO_SHARD: RaidTrinket = { id: 137419, itemLevel: 880, name: 'Chrono Shard', quality: 4, icon: 'inv_jewelcrafting_70_saberseye' };
const MEMENTO: RaidTrinket = { id: 133644, itemLevel: 895, name: 'Memento of Angerboda', quality: 5, icon: 'inv_misc_trinket6oih_lanternb1' };

function render(trinkets: ReadonlyArray<RaidTrinket>): HTMLElement {
  const fixture = TestBed.createComponent(RaidTrinketIconsComponent);
  fixture.componentRef.setInput('trinkets', trinkets);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('RaidTrinketIconsComponent', () => {
  it('links each trinket to its TauriShoot page, with its name and item level', () => {
    const element = render([CHRONO_SHARD, MEMENTO]);
    const links = [...element.querySelectorAll<HTMLAnchorElement>('a.icon')];

    expect(links.map(link => [link.href, link.getAttribute('aria-label'), link.dataset['tip'], link.dataset['tipNote']])).toEqual([
      ['https://legion-shoot.tauri.hu/?item=137419', 'Chrono Shard, item level 880', 'Chrono Shard', 'Item level 880'],
      ['https://legion-shoot.tauri.hu/?item=133644', 'Memento of Angerboda, item level 895', 'Memento of Angerboda', 'Item level 895']
    ]);
    expect(links[0].querySelector('img')!.getAttribute('src')).toBe('https://legion-static.tauri.hu/images/icons/medium/inv_jewelcrafting_70_saberseye.png');
  });

  it('frames each trinket and colours its tooltip name in its item quality colour', () => {
    const element = render([CHRONO_SHARD, MEMENTO]);
    const links = [...element.querySelectorAll<HTMLAnchorElement>('a.icon')];

    expect(links.map(link => link.dataset['tipColor'])).toEqual(['#a335ee', '#ff8000']);
    expect(links.map(link => link.style.borderColor)).toEqual(['rgb(163, 53, 238)', 'rgb(255, 128, 0)']);
  });

  it('shows a dash when the log has no trinkets', () => {
    const element = render([]);

    expect(element.querySelector('.icon')).toBeNull();
    expect(element.textContent!.trim()).toBe('-');
  });
});
