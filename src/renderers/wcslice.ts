
// Initially vendored from https://github.com/frouriojs/wcslice (MIT)
// at commit f2d133593b1df46aedbcd92ac9af37886a48c90e
// https://github.com/frouriojs/wcslice/blob/f2d133593b1df46aedbcd92ac9af37886a48c90e/src/index.ts

import { wcswidth } from 'simple-wcswidth';

/**
 * This treats last zero-length chars as infinitesimal length.
 */
export const wcslice = (str: string, start?: number | undefined, end?: number | undefined) => {
  const wclens = str.split('').reduce(
    (c, e) => {
      c.push(c[c.length - 1] + wcswidth(e));
      return c;
    },
    [0],
  );
  const wclen = wclens[wclens.length - 1];
  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = wclen + 1;
  }
  if (end < 0) end = 0;
  const strStart = (() => {
    let lo = -1;
    let hi = str.length;
    while (lo + 1 < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (wclens[mi] >= start) hi = mi;
      else lo = mi;
    }
    return hi;
  })();
  const strEnd = (() => {
    let lo = -1;
    let hi = str.length;
    while (lo + 1 < hi) {
      const mi = (lo + hi + 1) >> 1;
      if (wclens[mi] >= end) hi = mi;
      else lo = mi;
    }
    if (wcswidth(str.slice(0, hi)) > end) return hi - 1;
    return hi;
  })();
  return str.slice(strStart, strEnd);
};
