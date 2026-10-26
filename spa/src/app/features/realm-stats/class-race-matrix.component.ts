import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  ClassRaceMatrix,
  MatrixMode,
  matrixCellText,
  matrixHeat,
  matrixReadout,
  matrixTopCell
} from './realm-stats-views';

@Component({
  selector: 'app-class-race-matrix',
  templateUrl: './class-race-matrix.component.html',
  styleUrls: ['./class-race-matrix.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClassRaceMatrixComponent {
  readonly matrix = input.required<ClassRaceMatrix>();
  readonly mode = input.required<MatrixMode>();

  private readonly pointedKey = signal<string | undefined>(undefined);

  readonly groups = computed(() => {
    const matrix = this.matrix();
    const mode = this.mode();
    return matrix.groups.map(group => ({
      ...group,
      races: group.races.map(race => ({
        ...race,
        cells: race.cells.map(cell => ({ cell, heat: matrixHeat(cell, mode, matrix), text: matrixCellText(cell, mode) }))
      }))
    }));
  });

  readonly activeCell = computed(() => {
    const key = this.pointedKey();
    const matrix = this.matrix();
    const pointed = key === undefined ? undefined
      : matrix.groups.flatMap(group => group.races.flatMap(race => race.cells)).find(cell => cell.key === key);
    return pointed ?? matrixTopCell(matrix);
  });

  readonly readout = computed(() => {
    const cell = this.activeCell();
    return cell ? matrixReadout(cell) : undefined;
  });

  pointAt(event: Event): void {
    const key = (event.target as Element | null)?.closest('[data-cell]')?.getAttribute('data-cell');
    if (key) {
      this.pointedKey.set(key);
    }
  }
}
