
import type { RenderItemsFn } from '../types.js';

import { stringify } from 'csv-stringify/sync';

export const renderCSV: RenderItemsFn = (items, show_tags) => {
  process.stdout.write(stringify(
    items.map(({ tags }) => tags),
    { columns: show_tags, header: true },
  ));
};
