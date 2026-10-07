/**
 * Wraps text from outside the app (a station label, a gym or coach name) in Unicode
 * first-strong isolates, so "Platform 1" inside an Arabic sentence keeps its own order.
 */
export const isolate = (text: string) => `⁨${text}⁩`;
