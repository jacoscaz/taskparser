
import type { RenderItemsFn } from './types.js';

import { stringify } from 'csv-stringify/sync';
import columnify from 'columnify';

export const renderTabular: RenderItemsFn = (items, show_tags) => {
  const data = items.map((task) => { 
    const row: Record<string, any> = {};
    show_tags.forEach((tag) => {
      row[tag] = task.tags[tag] ?? '';
    });
    return row;
  });
  data.unshift(show_tags.reduce((acc, col) => { 
    acc[col] = ''.padStart(col.length, '-');
    return acc;
  }, {} as any));
  const opts: columnify.GlobalOptions = { 
    columns: show_tags, 
    columnSplitter: ' | ',
    headingTransform: data => data,
  };
  return columnify(data, opts);
};

export const renderCSV: RenderItemsFn = (items, show_tags) => {
  return stringify(items.map((task) => { 
    const row: Record<string, any> = {};
    show_tags.forEach((tag) => {
      row[tag] = task.tags[tag] ?? '';
    });
    return row;
  }), { columns: show_tags, header: true });
};

export const renderJSON: RenderItemsFn = (items, show_tags) => {
  return JSON.stringify(items.map((task) => {
    const entry: Record<string, any> = {};
    show_tags.forEach((tag) => {
      entry[tag] = task.tags[tag];
    });
    return entry;
  }));
};
