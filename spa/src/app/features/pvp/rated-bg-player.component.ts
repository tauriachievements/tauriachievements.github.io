import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { getClassColor } from '../../game/class-colors';
import { getClassIconPath } from '../../game/classIconHelper';
import { getRaceIconPath } from '../../game/raceIconHelper';
import { CLASS_NAMES, RACE_NAMES } from '../../game/wow';
import { specIconFor } from '../../game/wow-specs';
import { RosterPlayer } from './rated-bg-picker';
import { RatedBgMark, RatedBgMarkComponent } from './rated-bg-mark.component';

@Component({
  selector: 'app-rated-bg-player',
  templateUrl: './rated-bg-player.component.html',
  styleUrl: './rated-bg-player.component.scss',
  imports: [RatedBgMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatedBgPlayerComponent {
  readonly player = input.required<RosterPlayer>();
  readonly mark = input<RatedBgMark>();

  readonly raceIcon = computed(() => getRaceIconPath(this.player().race, this.player().gender));
  readonly raceName = computed(() => RACE_NAMES[this.player().race] ?? 'Unknown race');
  readonly classIcon = computed(() => getClassIconPath(this.player().classId));
  readonly className = computed(() => CLASS_NAMES[this.player().classId] ?? 'Unknown class');
  readonly specIcon = computed(() => {
    const { classId, spec } = this.player();
    return spec ? specIconFor(classId, spec) : undefined;
  });
  readonly classColor = computed(() => getClassColor(this.player().classId));
}
