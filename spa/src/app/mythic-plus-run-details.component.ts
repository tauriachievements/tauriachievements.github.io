import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { IconTipsComponent } from './icon-tips.component';
import { ROLE_LABELS, UPGRADE_CUTOFFS } from './mythic-plus';
import { MemberView, RunView } from './mythic-plus-views';
import { iconSrcset, itemIconUrl, spellUrl } from './raid-logs';
import { MemberTalents, memberKey } from './run-talents';
import { RunTalentsService } from './services/run-talents.service';

/** The panel under an expanded run: result, affixes, timer and the whole group, each linking to their profile. */
@Component({
  selector: 'app-mythic-plus-run-details',
  standalone: true,
  imports: [CommonModule, RouterLink, IconTipsComponent],
  templateUrl: './mythic-plus-run-details.component.html',
  styleUrl: './mythic-plus-run-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusRunDetailsComponent {
  private readonly talentsService = inject(RunTalentsService);

  readonly run = input.required<RunView>();

  readonly roleLabels = ROLE_LABELS;
  readonly cutoffMarks = UPGRADE_CUTOFFS.filter(cutoff => cutoff.percent < 100);
  readonly icon = itemIconUrl;
  readonly iconSrcset = iconSrcset;
  readonly spellUrl = spellUrl;

  /**
   * Talents from Legion Key History uploads, loaded when the panel opens: undefined while loading,
   * null when the run has none ("Addon not detected").
   */
  readonly talents = toSignal(
    toObservable(this.run).pipe(
      switchMap(run => this.talentsService.forRun({
        challengeId: run.dungeon.challengeId,
        keyLevel: run.keyLevel,
        completedAt: run.completedAt,
        clearTimeMs: run.clearTimeMs
      }))
    ),
    { initialValue: undefined }
  );

  talentsOf(member: MemberView): MemberTalents | undefined {
    return this.talents()?.members.get(memberKey(member.name, member.realm));
  }

  trackMember(index: number, member: MemberView): string {
    return `${member.name}-${member.realm}`;
  }
}
