/**
 * Shared by the animation directives. The CSS side (durations, easings, keyframes) lives in
 * src/scss/_motion.scss as --ease-out, --ease-spring and --dur-*; keep SPRING in step with --ease-spring.
 */

/** A soft spring that overshoots by under 2%. Same curve as --ease-spring. */
const SPRING = 'linear(0, .006, .025 2.8%, .101 6.1%, .539 18.9%, .721 25.3%, .849 31.5%, .937 38.1%, '
  + '.968 41.8%, .991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001)';
/** Fast start, soft landing. Same curve as --ease-out. */
const EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';

/** The spring for Web Animations, or a plain ease-out where linear() isn't supported (it throws there). */
export function springEasing(): string {
  return typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', SPRING) ? SPRING : EASE_OUT;
}

/** The reader asked their system for less motion; the directives then skip straight to the end state. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A `view-transition-name` for a character, the same on every page that shows them, so a page change
 * can carry them from one place to the next. Character keys hold `#`, Cyrillic and other characters a
 * CSS name can't, so the name is a hash of the key (FNV-1a).
 */
export function characterTransitionName(key: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `mplus-character-${(hash >>> 0).toString(36)}`;
}
