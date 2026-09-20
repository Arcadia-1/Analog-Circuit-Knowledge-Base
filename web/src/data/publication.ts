/**
 * Lessons that are ready to represent the public site.
 *
 * Every other lesson still builds and remains available by its direct URL, but
 * is deliberately omitted from the home page and search index until it reaches
 * the same editorial and visual standard.
 */
export const publicLessonPaths = [
  '/adc/aliasing-and-nyquist-zones/',
  '/adc/binary-vs-redundant-sar/',
  '/adc/analog-panel/',
  '/adc/time-interleaved-adcs/',
] as const;

const publicLessonPathSet = new Set<string>(publicLessonPaths);

export function isPublicLessonPath(pathname: string): boolean {
  return publicLessonPathSet.has(pathname);
}

export function isLessonPath(pathname: string): boolean {
  return pathname.startsWith('/adc/') || pathname.startsWith('/pll/');
}
