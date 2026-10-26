import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SkeletonBlock } from './skeleton';
import { SkeletonComponent } from './skeleton.component';

@Component({
  selector: 'app-load-state',
  template: `
    @if (loading()) {
      @if (skeleton(); as blocks) {
        <app-skeleton [blocks]="blocks" [label]="loadingText()" />
      } @else {
        <section class="feedback" role="status">
          <span class="spinner" aria-hidden="true"></span>
          <p>{{ loadingText() }}</p>
        </section>
      }
    } @else if (error(); as message) {
      <section class="feedback error">
        <p>{{ message }}</p>
        <ng-content />
        <button type="button" (click)="retry.emit()">Try again</button>
      </section>
    }
  `,
  styleUrl: './load-state.component.scss',
  imports: [SkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadStateComponent {
  readonly loading = input.required<boolean>();
  readonly error = input<string>();
  readonly loadingText = input('Loading...');
  readonly skeleton = input<readonly SkeletonBlock[]>();
  readonly retry = output<void>();
}
