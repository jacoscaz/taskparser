
import type { Item, RenderItemsFn } from '../types.js';

import { EOL } from 'node:os';
import { wcswidth } from 'simple-wcswidth';

import { wcslice } from './wcslice.js';

const row_delimiter = '-';
const column_delimiter = ' | ';

type ColumnRenderer = (value: string, width: number) => string;

const renderWithPadding: ColumnRenderer = (value: string, width: number) => {
  return value.padEnd(width, ' ');
};

const renderWithEllipsis: ColumnRenderer = (value: string, width: number) => {
  return wcswidth(value) > width 
    ? wcslice(value, 0, width - 1) + '…'
    : value.padEnd(width, ' ');
};

interface ColumnDescriptor {
  tag: string;
  width: number;
  renderer: ColumnRenderer;
}

const { stdout } = process;

const printItem = (columns: ColumnDescriptor[], item: Item) => {
  columns.forEach(({ tag, renderer, width }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderer(item.tags[tag] ?? '', width));
  });
};

/**
 * This rendering function renders items in tabular / columnar form.
 * If the "text" tag is selected for display, longer values are truncated and
 * ellipsed in a best-effort to fit each line within the width of the terminal.
 */
export const renderTabular: RenderItemsFn = (items, show_tags, opts) => {

  const columns: ColumnDescriptor[] = show_tags.map((tag) => ({
    tag,
    width: wcswidth(tag),
    renderer: renderWithPadding,
  }));

  // Calculate the width of each column
  columns.forEach((column) => {
    let { tag, width } = column;
    items.forEach((item) => {
      if (tag in item.tags) {
        width = Math.max(wcswidth(item.tags[tag] ?? ''), width);
      }
    });
    column.width = width;
  });

  // Calculate terminal width
  const line_width = columns.reduce((acc, c) => acc + c.width, 0) 
      + (column_delimiter.length * (columns.length - 1));

  // If the 'text' tag has been selected and the predicted line width exceeds
  // the width of the terminal we change the column renderer to the ellipsis
  // renderer and recalculate a new maximum width for the 'text' column that 
  // still allows for the entire line to fit within the terminal width
  const text_column = columns.find(c => c.tag === 'text');
  if (text_column && line_width >= opts.terminal_width) {
      text_column.width = Math.max(wcswidth(text_column.tag), text_column.width - (line_width - opts.terminal_width));
      text_column.renderer = renderWithEllipsis;
  }

  // Print headers line
  columns.forEach(({ tag, renderer, width }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderer(tag, width));
  });
  stdout.write(EOL);

  // Print header separator line
  columns.forEach(({ tag, renderer, width }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderer(''.padEnd(tag.length, row_delimiter), width));
  });
  stdout.write(EOL);
  
  // Print items
  items.forEach((item) => {
    printItem(columns, item);
    stdout.write(EOL);
  });
};
