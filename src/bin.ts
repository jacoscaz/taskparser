#!/usr/bin/env node

import type { Item, RenderItemsFn, RenderOpts } from './types.js';

import { fileURLToPath } from 'node:url';
import { cwd } from 'node:process';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

import { ArgumentParser } from 'argparse';

import { parseFolder } from './parse.js';
import { renderCSV } from './renderers/csv.js';
import { renderJSON } from './renderers/json.js';
import { renderTabular } from './renderers/table.js';

import { 
  compileTagFilterExpressions, 
  compileTagSortExpressions, 
  parseTagFilterExpressions, 
  parseTagSortExpressions,
} from './tags.js';
import { renderTodayFile } from './today.js';

const pkg_path = resolve(fileURLToPath(import.meta.url), '..', '..', 'package.json');
const pkg_version = JSON.parse(readFileSync(pkg_path, 'utf8')).version;

// ============================================================================
//                                    CLI ARGS
// ============================================================================

const arg_parser = new ArgumentParser({
  description: 'A CLI tool to parse, sort and filter tasks and worklogs out of Markdown documents and print them to standard output, either in tabular of CSV format.',
});

arg_parser.add_argument('-t', '--tags', {
  required: false,
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

arg_parser.add_argument('-l', '--worklogs', {
  required: false,
  action: 'store_true',
  help: 'enable worklogs mode',
});

arg_parser.add_argument('-C', '--checked', {
  required: false,
  action: 'store_true',
  help: 'only show checked tasks',
});

arg_parser.add_argument('-U', '--unchecked', {
  required: false,
  action: 'store_true',
  help: 'only show unchecked tasks',
});

arg_parser.add_argument('-o', '--out', {
  required: false,
  default: 'tabular',
  choices: ['table', 'csv', 'json'],
  help: 'set output format'
});

arg_parser.add_argument('-c', '--columns', {
  required: false,
  default: String(process.stdout.columns),
  help: 'override detected terminal width (in character columns)'
});

arg_parser.add_argument('-v', '--version', {
  action: 'version',
  version: pkg_version,
});

arg_parser.add_argument('--today', {
  required: false,
  action: 'store_true',
  help: 'generate a new today file at the given path',
});

arg_parser.add_argument('--title', {
  required: false,
  default: 'Today',
  help: 'title for the new today file',
});

arg_parser.add_argument('path', {
  default: cwd(),
  help: 'working directory',
});

const cli_args = arg_parser.parse_args();

const folder_path = resolve(cwd(), cli_args.path);

// ============================================================================
//                                    TODAY
// ============================================================================

if (cli_args.today) {
  const { f_name, f_data } = renderTodayFile(new Date(), cli_args.title.trim());
  const f_path = resolve(cli_args.path, f_name);
  try {
    await writeFile(f_path, f_data, { encoding: 'utf-8', flag: 'wx' });
    console.log('created new today file at %s', f_path);
  } catch (err) {
    if ((err as any).code === 'EEXIST') {
      console.error('Error! File %s already exists!', f_path);
    } else {
      throw err;
    }
  }
  process.exit(0);
}

// ============================================================================
//                                  FILTERING
// ============================================================================

// While parsing filtering expressions we need to consider CLI shortcuts, which
// we can concatenate with the optional explicit filtering expression.

const filter_exprs = [];

if (cli_args.checked) {
  // Shortcut for showing checked items only
  filter_exprs.push('checked(=true)');
}

if (cli_args.unchecked) {
  // Shortcut for showing unchecked items only
  filter_exprs.push('checked(=false)');
}

if (cli_args.filter) {
  // Explicit filtering expression
  filter_exprs.push(cli_args.filter);
}

const filter_expr = filter_exprs.join(',');

const filter_fn = filter_expr ? compileTagFilterExpressions(parseTagFilterExpressions(filter_expr)) : null;

// ============================================================================
//                                    SORTING
// ============================================================================

const sort_expr = cli_args.sort;

const sorting_fn = sort_expr ? compileTagSortExpressions(parseTagSortExpressions(sort_expr)) : null;

// ============================================================================
//                                 TAGS TO SHOW
// ============================================================================

const show_tags = cli_args.tags 
  ? cli_args.tags.split(',') 
  : cli_args.worklogs 
    ? ['text', 'hours', 'file', 'date'] 
    : ['text', 'checked', 'file', 'date'];

// ============================================================================
//                          RENDERING OPTIONS and FN
// ============================================================================

const render_opts: RenderOpts = { 
  terminal_width: parseInt(cli_args.columns),
};

const render_fn = ({
  json: renderJSON,
  csv: renderCSV,
  table: renderTabular,
} satisfies Record<string, RenderItemsFn>)[cli_args.out as string] ?? renderTabular;

// ============================================================================
//                              RENDERING HELPER
// ============================================================================

const renderItems = (items: Set<Item>) => {
  let as_arr = Array.from(items);
  if (filter_fn) {
    as_arr = as_arr.filter(filter_fn);
  }
  if (sorting_fn) {
    as_arr.sort(sorting_fn);
  }
  render_fn(as_arr, show_tags, render_opts);
};

// ============================================================================
//                            3.. 2.. 1.. LET'S GO!
// ============================================================================

const { tasks, worklogs } = await parseFolder(folder_path); 
renderItems(cli_args.worklogs ? worklogs : tasks);
