import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { getArmoryUrl } from '../utils/armory';
import { getClassColor } from './class-colors';
import { DecodeDirective } from './decode.directive';
import { characterProfileLink } from './mythic-plus-profile';
import { RevealDirective } from './reveal.directive';
import { ScrollRiseDirective } from './scroll-rise.directive';
import { SpotlightDirective } from './spotlight.directive';
import {
  DONATIONS,
  PlayerName,
  TESTIMONIALS,
  donationIcon,
  formatDonation,
  quoteSpans,
  testimonialSourceLabel
} from './support';

const QUOTE_SPANS = quoteSpans(TESTIMONIALS.map(({ quote }) => quote));

function shownName({ name, classId, realm, mythicPlusProfile }: PlayerName) {
  return {
    name,
    color: classId ? getClassColor(classId) : undefined,
    profileLink: realm && mythicPlusProfile ? characterProfileLink({ name: mythicPlusProfile, realm }) : null,
    armoryUrl: realm ? getArmoryUrl(name, realm) : null
  };
}

@Component({
  selector: 'app-support-page',
  imports: [
    RouterLink,
    DecodeDirective,
    RevealDirective,
    ScrollRiseDirective,
    SpotlightDirective,
    NgTemplateOutlet
  ],
  templateUrl: './support-page.component.html',
  styleUrls: ['./support-page.component.scss', './support-page.motion.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportPageComponent {
  protected readonly discordUrl = 'https://discord.com/users/415206422503096320';
  protected readonly donations = DONATIONS.map((donation) => ({
    ...donation,
    names: donation.names.map(shownName),
    icon: donationIcon(donation.currency),
    amountLabel: formatDonation(donation)
  }));
  protected readonly testimonials = TESTIMONIALS.map((testimonial, index) => ({
    ...testimonial,
    names: testimonial.names.map(shownName),
    fromLabel: testimonialSourceLabel(testimonial.from),
    span: QUOTE_SPANS[index]
  }));
}
