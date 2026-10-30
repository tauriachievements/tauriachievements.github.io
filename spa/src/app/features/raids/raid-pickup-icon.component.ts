import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-raid-pickup-icon',
  host: { class: 'pickup-icon' },
  template: `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="6" cy="5" r="2.6" />
      <path d="M1.4 13.6c0-2.7 2-4.6 4.6-4.6s4.6 1.9 4.6 4.6z" />
      <circle cx="11.2" cy="5.6" r="2.1" />
      <path d="M10.4 9.2c2.4 0 4.2 1.8 4.2 4.4h-3.1c0-1.7-.4-3.2-1.1-4.4z" />
    </svg>
  `,
  styles: [`
    @use './raid-logs-shared' as *;
    :host { display: inline-flex; width: 14px; height: 14px; flex: none; margin: 0 -3px; }
    svg { width: 100%; height: 100%; fill: $pickup-silver; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidPickupIconComponent {}
