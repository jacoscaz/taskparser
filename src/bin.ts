#!/usr/bin/env node

import type { Item } from './types.js';

import { cwd } from 'node:process';
import { resolve } from 'node:path';

import { ArgumentParser } from 'argparse';

import { parseFolder, watchFolder } from './parse.js';
import { renderCSV, renderJSON, renderTabular } from './render.js';

import { 
  compileTagFilterExpressions, 
  compileTagSortExpressions, 
  parseTagFilterExpressions, 
  parseTagSortExpressions,
} from './tags.js';

const arg_parser = new ArgumentParser({
  description: 'A CLI tool to parse, sort and filter tasks and worklogs out of Markdown documents and print them to standard output, either in tabular of CSV format.',
});

arg_parser.add_argument('-t', '--tags', {
  required: false,
  default: 'text,done,file,date',
  help: 'comma-separated list of tags to show',
});
arg_parser.add_argument('-f', '--filter', {
  required: false,
  help: 'filtering expression such as: foo(=bar)'
});
arg_parser.add_argument('-s', '--sort', {
  required: false,
  help: 'sorting expression such as: foo(asc)'
});
arg_parser.add_argument('-w', '--watch', {
  required: false,
  action: 'store_true',
  help: 'enable watch mode'
});
arg_parser.add_argument('-W', '--worklogs', {
  required: false,
  action: 'store_true',
  help: 'enable worklogs mode',
});
arg_parser.add_argument('-o', '--out', {
  required: false,
  default: 'tabular',
  choices: ['tabular', 'csv', 'json'],
  help: 'set output format'
});
arg_parser.add_argument('path', {
  default: cwd(),
  help: 'working directory',
});

const cli_args = arg_parser.parse_args();

const folder_path = resolve(cwd(), cli_args.path);

const sorter = cli_args.sort ? compileTagSortExpressions(parseTagSortExpressions(cli_args.sort)) : null;
const filter = cli_args.filter ? compileTagFilterExpressions(parseTagFilterExpressions(cli_args.filter)) : null;

const show_tags = cli_args.tags.split(',');

const renderItems = (items: Set<Item>) => {
  let as_arr = Array.from(items);
  if (filter) {
    as_arr = as_arr.filter(filter);
  }
  if (sorter) {
    as_arr.sort(sorter);
  }
  switch (cli_args.out) {
    case 'json':
      console.log(renderJSON(as_arr, show_tags));
      break;
    case 'csv':
      console.log(renderCSV(as_arr, show_tags));
      break;
    case 'tabular':
    default:
      console.log(renderTabular(as_arr, show_tags));
  }
};

if (cli_args.watch) {
  const { stdout } = process;
  if (!stdout.isTTY) {
    throw new Error('cannot use -w/--watch if the terminal is not a TTY');
  }
  for await (const { tasks, worklogs } of watchFolder(folder_path)) {
    stdout.write('\x1bc');
    renderItems(cli_args.worklogs ? worklogs : tasks);
  }  
} else {
  const { tasks, worklogs } = await parseFolder(folder_path); 
  renderItems(cli_args.worklogs ? worklogs : tasks);
}

