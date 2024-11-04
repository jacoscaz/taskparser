
import type { Item, RenderItemsFn } from './types.js';

import { EOL } from 'node:os';
import { wcswidth } from 'simple-wcswidth';
import { stringify } from 'csv-stringify/sync';

import { wcslice } from './wcslice.js';

type Row = Record<string, string>;

const toRow = (item: Item, show_tags: string[]): Row => {
  return show_tags.reduce((acc, tag) => {
    acc[tag] = item.tags[tag];
    return acc;
  }, Object.create(null));
};

const toRows = (items: Item[], show_tags: string[]): Row[] => {
  return items.map(item => toRow(item, show_tags));
};

const row_delimiter = '-';
const column_delimiter = ' | ';

/**
 * This rendering function renders items in tabular / columnar form.
 * If the "text" tag is selected for display, longer values are truncated and
 * ellipsed in a best-effort to fit each line within the width of the terminal.
 */
export const renderTabular: RenderItemsFn = (items, show_tags, opts) => {

  // Total number of items to go through
  let items_qty = items.length;

  // Maximum value lengths per tag to be displayed
  const lengths: number[] = show_tags.map(() => 0);

  // Array of values per tag to be displayed
  const values: string[][] = show_tags.map(() => new Array(items_qty));

  // Populate lengths and values
  items.forEach((item, i) => {
    show_tags.forEach((tag, t) => {
      const value = item.tags[tag]?.replaceAll(/\r?\n/g, '') ?? '';
      lengths[t] = Math.max(wcswidth(value), lengths[t]);
      values[t][i] = value;
    });
  });

  // Additional rows for headers and header delimiter
  show_tags.forEach((tag, t) => {
    const tag_width = wcswidth(tag);
    lengths[t] = Math.max(tag_width, lengths[t]);
    values[t].unshift(''.padStart(tag_width, row_delimiter));
    values[t].unshift(tag);
  });
  items_qty += 2;

  // Special processing for values of the "text" tag
  const text_tag_i = show_tags.findIndex(t => t === 'text');
  if (text_tag_i > -1) {
    const line_length = lengths.reduce((acc, l) => acc + l, 0) 
      + (column_delimiter.length * (lengths.length - 1));
    if (line_length >= process.stdout.columns) {
      const text_length = Math.max('text'.length, lengths[text_tag_i]
        - (line_length - process.stdout.columns));
      values[text_tag_i] = values[text_tag_i]
        .map(v => wcswidth(v) > text_length ? wcslice(v, 0, text_length - 1) + '…' : v);
      lengths[text_tag_i] = text_length;
    }
  }

  const lines = new Array(items_qty);

  for (let i = 0; i < items_qty; i += 1) {
    lines[i] = wcslice(
      show_tags.map((tag, t) => values[t][i].padEnd(lengths[t], ' '))
        .join(column_delimiter), 
      0, 
      process.stdout.columns,
    );
  }

  return lines.join(EOL);
};

export const renderCSV: RenderItemsFn = (items, show_tags) => {
  return stringify(
    toRows(items, show_tags), 
    { columns: show_tags, header: true },
  );
};

export const renderJSON: RenderItemsFn = (items, show_tags) => {
  return JSON.stringify(toRows(items, show_tags));
};
