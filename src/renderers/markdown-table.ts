
import type { Item, RenderItemsFn } from '../types.js';

import { EOL } from 'node:os';
import { wcswidth } from 'simple-wcswidth';

import { wcslice } from './wcslice.js';

interface ColumnRenderer {
  (value: string, width: number): string;
}

interface ColumnDescriptor {
  tag: string;
  width: number;
  calculate_width: boolean;
  renderValue: ColumnRenderer;
  renderHeader: ColumnRenderer;
}

const row_delimiter = '-';
const column_delimiter = ' | ';

const { stdout } = process;

const renderWithPadding: ColumnRenderer = (value: string, width: number) => {
  return value.padEnd(width - (wcswidth(value) - value.length), ' ');
};

const renderWithEllipsis: ColumnRenderer = (value: string, width: number) => {
  return wcswidth(value) > width 
    ? wcslice(value, 0, width - 1) + '…'
    : renderWithPadding(value, width);
};

const printItemLine = (columns: ColumnDescriptor[], item: Item) => {
  columns.forEach(({ tag, renderValue, width }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderValue(item.tags[tag] ?? '', width));
  });
};

const shortenWord = (word: string, max_len: number): string => {
  if (word.length <= max_len) return word;
  return word.replaceAll(/[aeiou]/g, '').slice(0, max_len);
};

const buildColumnDescriptors = (show_tags: string[]): ColumnDescriptor[] => {
  return show_tags.map((tag) => {
    const descriptor: ColumnDescriptor = {
      tag,
      width: wcswidth(tag),
      calculate_width: true,
      renderValue: renderWithPadding,
      renderHeader: renderWithPadding,
    };
    switch (tag) {
      case 'hours':
        descriptor.width = 1;
        descriptor.renderValue = renderWithPadding;
        descriptor.renderHeader = val => shortenWord(val, descriptor.width);
        break;
      case 'checked':
        descriptor.width = 1;
        descriptor.calculate_width = false;
        descriptor.renderValue = val => val === 'true' ? '✔' : ' ';
        descriptor.renderHeader = val => val.charAt(0);
        break;
    }
    return descriptor;
  });
};

/**
 * This rendering function renders items in tabular / columnar form.
 * If the "text" tag is selected for display, longer values are truncated and
 * ellipsed in a best-effort to fit each line within the width of the terminal.
 */
export const renderMarkdownTable: RenderItemsFn = (items, show_tags, opts) => {

  const { terminal_width } = opts;

  const columns = buildColumnDescriptors(show_tags);

  // Calculate the width of each column
  columns.forEach((column) => {
    let { tag, width, calculate_width } = column;
    if (calculate_width) {
      items.forEach((item) => {
        if (tag in item.tags) {
          width = Math.max(wcswidth(item.tags[tag] ?? ''), width);
        }
      });
      column.width = width;
    }
  });

  // If the 'text' tag has been selected and the predicted line width exceeds
  // the width of the terminal we change the column renderer to the ellipsis
  // renderer and recalculate a new maximum width for the 'text' column that 
  // still allows for the entire line to fit within the terminal width
  columns.forEach((column) => {
    switch (column.tag) {
      case 'text': {
        const line_width = columns.reduce((acc, c) => acc + c.width, 0) 
          + (column_delimiter.length * (columns.length - 1));
        if (line_width >= terminal_width) {
          column.width = Math.max(
            wcswidth(column.tag), 
            column.width - (line_width - terminal_width),
          );
          column.renderValue = renderWithEllipsis;
        }
      } break;
    }
  });
  
  // Print headers line
  columns.forEach(({ tag, width, renderHeader }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderHeader(tag, width));
  });
  stdout.write(EOL);

  // Print header separator line
  columns.forEach(({ tag, width, renderHeader }, t) => {
    if (t > 0) {
      stdout.write(column_delimiter);
    }
    stdout.write(renderHeader(''.padEnd(wcswidth(tag), row_delimiter), width));
  });
  stdout.write(EOL);
  
  // Print items
  items.forEach((item) => {
    printItemLine(columns, item);
    stdout.write(EOL);
  });
};
