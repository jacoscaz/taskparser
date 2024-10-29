
import type { Item, RenderItemsFn } from './types.js';

import { stringify } from 'csv-stringify/sync';
import columnify from 'columnify';

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

export const renderTabular: RenderItemsFn = (items, show_tags) => {
  const rows = toRows(items, show_tags);
  rows.unshift(show_tags.reduce((acc, col) => { 
    acc[col] = ''.padStart(col.length, '-');
    return acc;
  }, {} as any));
  return columnify(rows, { 
    columns: show_tags, 
    columnSplitter: ' | ',
    headingTransform: heading => heading,
  });
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
