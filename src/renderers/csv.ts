
import type { RenderItemsFn } from '../types.js';

import { stringify } from 'csv-stringify/sync';

export const renderCSV: RenderItemsFn = (items, show_tags) => {
  process.stdout.write(stringify(
    items.map(({ tags }) => {
      if (tags.date) {
        tags.date = `${tags.date.slice(0, 4)}-${tags.date.slice(4, 6)}-${tags.date.slice(6, 8)}`;
      }
      return tags;
    }),
    { columns: show_tags, header: true },
  ));
};
