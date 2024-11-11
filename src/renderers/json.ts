
import type { Item, RenderItemsFn } from '../types.js';

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

export const renderJSON: RenderItemsFn = (items, show_tags) => {
  process.stdout.write(JSON.stringify(toRows(items, show_tags)));
};
