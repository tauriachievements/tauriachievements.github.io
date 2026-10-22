import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BackToTopButtonComponent } from './back-to-top-button.component';
import { UpdateBarComponent } from './update-bar.component';

@Component({
  selector: 'app-mythic-plus-scoring-page',
  imports: [RouterLink, UpdateBarComponent, BackToTopButtonComponent],
  templateUrl: './mythic-plus-scoring-page.component.html',
  styleUrl: './mythic-plus-scoring-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusScoringPageComponent {}
