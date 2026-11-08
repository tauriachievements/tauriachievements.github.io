import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RaidTalent } from './raid-logs.types';
import { RaidTalentIconsComponent } from './raid-talent-icons.component';

const CHI_BURST: RaidTalent = { id: 123986, name: 'Chi Burst', icon: 'ability_monk_chiburst' };
const CELERITY: RaidTalent = { id: 115173, name: 'Celerity', icon: 'ability_monk_quipunch' };

function render(talents: ReadonlyArray<RaidTalent | undefined>): HTMLElement {
  const fixture = TestBed.createComponent(RaidTalentIconsComponent);
  fixture.componentRef.setInput('talents', talents);
  fixture.detectChanges();
  return fixture.nativeElement;
}

describe('RaidTalentIconsComponent', () => {
  it('links each picked talent to its TauriShoot page, with its tooltip', () => {
    const element = render([CHI_BURST, CELERITY]);
    const links = [...element.querySelectorAll<HTMLAnchorElement>('a.icon')];

    expect(links.map(link => [link.href, link.getAttribute('aria-label'), link.dataset['tip'], link.dataset['tipSpell']])).toEqual([
      ['https://legion-shoot.tauri.hu/?spell=123986', 'Chi Burst', 'Chi Burst', '123986'],
      ['https://legion-shoot.tauri.hu/?spell=115173', 'Celerity', 'Celerity', '115173']
    ]);
    expect(links[0].querySelector('img')!.getAttribute('src')).toBe('https://legion-static.tauri.hu/images/icons/medium/ability_monk_chiburst.png');
  });

  it('keeps the place of a tier with no talent picked', () => {
    const element = render([CHI_BURST, undefined, CELERITY]);

    expect([...element.querySelectorAll('.icon')].map(icon => icon.getAttribute('data-tip'))).toEqual(['Chi Burst', 'No talent picked', 'Celerity']);
    expect(element.querySelector('span.icon.empty')).not.toBeNull();
  });

  it('shows a dash when the log has no talents', () => {
    const element = render([]);

    expect(element.querySelector('.icon')).toBeNull();
    expect(element.textContent!.trim()).toBe('-');
  });
});
