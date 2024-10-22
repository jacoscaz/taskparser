
import type { Parent, Node, Yaml, ListItem } from 'mdast';
import type { TagMap, Task, TaskSet, Worklog, WorklogSet, ParseResult } from './types.js';

import { readdir, readFile, watch, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { gfm } from 'micromark-extension-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';

import { extractTagsFromText, extractTagsFromYaml } from './tags.js';

export interface ParseContext {
  folder: string;
}

interface ParseFileContext extends ParseContext {
  file: string;
  tags: TagMap;
  internal_tags: TagMap;
}

const parseTaskNode = (node: Node, task: Task, worklogs: WorklogSet) => {
  if (node.type === 'text') {
    if (!('text' in task.internal_tags)) {
      task.internal_tags.text = (node as any).value;
    }
    const node_tags: TagMap = Object.create(null); 
    extractTagsFromText((node as any).value, node_tags);
    if ('worklog' in node_tags) {
      const worklog: Worklog = {
        task,
        tags: { ...task.tags, ...node_tags },
        internal_tags: { ...task.internal_tags },
        file: task.file,
      };
      task.worklogs.push(worklog);
      worklogs.add(worklog);
    } else {
      Object.assign(task.tags, node_tags);
    }
  }
  if ('children' in node) {
    for (const child of (node.children as Node[])) {
      parseTaskNode(child, task, worklogs);
    }
  }
};

const parseYamlNode = (node: Yaml, ctx: ParseFileContext) => {
  extractTagsFromYaml(node.value, ctx.tags);
};

const parseParentNode = (node: Parent, ctx: ParseFileContext, tasks: TaskSet, worklogs: WorklogSet) => {
  node.children.forEach(node => parseNode(node, ctx, tasks, worklogs));
};

const parseListItemNode = (node: ListItem, ctx: ParseFileContext, tasks: TaskSet, worklogs: WorklogSet) => {
  if (typeof node.checked === 'boolean') {
    const tags: TagMap = { ...ctx.tags };
    const internal_tags: TagMap = {
      ...ctx.internal_tags,
      line: String(node.position!.start.line),
      done: String(node.checked),
    };
    const task: Task = { tags, internal_tags, file: ctx.file, worklogs: [] };
    parseTaskNode(node, task, worklogs);
    Object.assign(tags, internal_tags);
    tasks.add(task);
  }
};

const parseNode = (node: Node, ctx: ParseFileContext, tasks: TaskSet, worklogs: WorklogSet) => {
  switch (node.type) {
    case 'yaml': 
      parseYamlNode(node as Yaml, ctx); 
      break;
    case 'listItem': 
      parseListItemNode(node as ListItem, ctx, tasks, worklogs); 
      break;
    default:
      if ('children' in node) {
        parseParentNode(node as Parent, ctx, tasks, worklogs);
      }
  }
};

const from_markdown_opts =  {
  extensions: [frontmatter(['yaml']), gfm()],
  mdastExtensions: [frontmatterFromMarkdown(['yaml']), gfmFromMarkdown()],
};

const DATE_IN_FILENAME_REGEXP = /(?:^|[^\d])(\d{8}|(?:\d{4}-\d{2}-\d{2}))(?:$|[^\d])/;

export const parseFile = async (ctx: ParseFileContext, tasks: TaskSet, worklogs: WorklogSet) => {
  tasks.forEach((task) => {
    if (task.file === ctx.file) {
      tasks.delete(task);
    }
  });
  worklogs.forEach((worklog) => {
    if (worklog.file === ctx.file) {
      worklogs.delete(worklog);
    }
  });
  try {
    const data = await readFile(ctx.file, { encoding: 'utf8' });
    const root_node = fromMarkdown(data, from_markdown_opts);
    const date_match = ctx.file.match(DATE_IN_FILENAME_REGEXP);
    if (date_match) {
      ctx.tags['date'] = date_match[1].replaceAll('-', '');
    }
    parseNode(root_node, ctx, tasks, worklogs);
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      throw err;
    }
  }
};

const parseFolderHelper = async (ctx: ParseContext, target_path: string, tasks: TaskSet, worklogs: WorklogSet) => {
  const target_stats = await stat(target_path);
  if (target_stats.isFile() && target_path.endsWith('.md')) {
    const target_rel_path = relative(ctx.folder, target_path);
    await parseFile({ 
      ...ctx, 
      file: target_path, 
      tags: {}, 
      internal_tags: { file: target_rel_path },
    }, tasks, worklogs);
  } else if (target_stats.isDirectory()) {
    const child_names = await readdir(target_path);
    for (const child_name of child_names) {
      const child_path = resolve(ctx.folder, child_name);
      await parseFolderHelper(ctx, child_path, tasks, worklogs);
    }
  }
};

export const parseFolder = async (folder_path: string): Promise<ParseResult> => {
  const ctx: ParseContext = {
    folder: folder_path,
  };
  const tasks: TaskSet = new Set();
  const worklogs: WorklogSet = new Set();
  await parseFolderHelper(ctx, folder_path, tasks, worklogs);
  return { tasks, worklogs };
};

export async function* watchFolder(folder_path: string): AsyncIterable<ParseResult> {
  const ctx: ParseContext = {
    folder: folder_path,
  };
  const tasks: TaskSet = new Set();
  const worklogs: WorklogSet = new Set();
  await parseFolderHelper(ctx, folder_path, tasks, worklogs);
  yield { tasks, worklogs };
  for await (const evt of watch(ctx.folder)) {
    if (evt.filename) {
      const file_path = resolve(ctx.folder, evt.filename);
      switch (evt.eventType) {
        case 'change':
        case 'rename':
          await parseFile({ 
            ...ctx, 
            file: file_path, 
            internal_tags: { file: evt.filename },
            tags: {},
          }, tasks, worklogs);
          yield { tasks, worklogs };
          break;
      }
    }
  }
};
