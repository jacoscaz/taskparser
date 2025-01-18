
import type { Parent, Node, Yaml, ListItem, Text, Heading } from 'mdast';
import type { TagMap, Task, Worklog, ParseContext, ParseFileContext, InternalTagMap, ParsedHeading } from './types.js';

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { load } from 'js-yaml';

import { gfm } from 'micromark-extension-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';

import { extractTagsFromText, extractTagsFromYaml } from './tags.js';
import { FOLDER_META_FILE } from './utils.js';

const WL_REGEXP = /^WL:(\d{1,2}(?:\.\d{1,2})?)[hH]\s/;

const isListNodeWorklog = (node: ListItem): boolean => {
  const paragraph = node.children[0];
  if (!paragraph || paragraph.type !== 'paragraph') {
    return false;
  }
  const worklog = paragraph.children[0];
  if (!worklog || worklog.type !== 'text') {
    return false;
  }
  return WL_REGEXP.test(worklog.value);
};

const trimTextNodeText = (text: string) => {
  return text.trim()
    .replaceAll(/\r?\n/g, ' ')
    .replace(/\s+/, ' ');
};

const parseTextNode = (node: Text, ctx: ParseFileContext, curr_task: Task | null, curr_wlog: Worklog | null) => {
  if (curr_wlog) {
    let match;
    if (!('text' in curr_wlog.internal_tags) && (match = node.value.match(WL_REGEXP))) {
      const [full, hours] = match;
      const text = trimTextNodeText(node.value.slice(full.length))
      curr_wlog.internal_tags.hours = hours;
      curr_wlog.internal_tags.text = text;
      extractTagsFromText(text, curr_wlog.tags);
    } else {
      extractTagsFromText(node.value, curr_wlog.tags);
    }
  }
  if (curr_task) {
    if (!('text' in curr_task.internal_tags)) {
      const text = trimTextNodeText(node.value);
      curr_task.internal_tags.text = text;
      extractTagsFromText(text, curr_task.tags);
    } else {
      extractTagsFromText(node.value, curr_task.tags);
    }
  }
};


const parseListItemNode = (node: ListItem, ctx: ParseFileContext, curr_task: Task | null, curr_wlog: Worklog | null) => {
  if (!curr_task && typeof node.checked === 'boolean') {
    const tags: TagMap = { ...ctx.tags };
    const internal_tags: InternalTagMap = {
      ...ctx.internal_tags,
      ...ctx.curr_heading?.tags,
      line: String(node.position!.start.line),
      checked: String(node.checked),
    };
    const task: Task = { tags, internal_tags, file: ctx.file, worklogs: [] };
    parseParentNode(node as Parent, ctx, task, curr_wlog);
    Object.assign(tags, internal_tags);
    ctx.tasks.add(task);
  } else if (!curr_wlog && isListNodeWorklog(node)) {
    const tags: TagMap = { ...ctx.tags };
    const internal_tags: TagMap = {
      ...ctx.internal_tags,
      ...ctx.curr_heading?.tags,
      line: String(node.position!.start.line),
    };
    const worklog: Worklog = { tags, internal_tags, file: ctx.file, task: curr_task };
    parseParentNode(node as Parent, ctx, curr_task, worklog);
    Object.assign(tags, internal_tags);
    ctx.worklogs.add(worklog);
  } else {
    parseParentNode(node, ctx, curr_task, curr_wlog);
  }
};

const parseParentNode = (node: Parent, ctx: ParseFileContext, curr_task: Task | null, curr_wlog: Worklog | null) => {
  node.children.forEach((node) => {
    parseNode(node, ctx, curr_task, curr_wlog); 
  });
};

const parseHeadingNode = (node: Heading, ctx: ParseFileContext, curr_task: Task | null, curr_wlog: Worklog | null) => {
  let parent = ctx.curr_heading;
  while (parent && parent.depth > node.depth) {
    parent = parent.parent;
  }
  const tags = parent ? { ...parent.tags } : {};
  const text = trimTextNodeText((node.children[0] as Text).value);
  extractTagsFromText(text, tags);
  ctx.curr_heading = { depth: node.depth, tags, parent };
};

const parseNode = (node: Node, ctx: ParseFileContext, curr_task: Task | null, curr_wlog: Worklog | null) => {
  switch (node.type) {
    case 'yaml': 
      extractTagsFromYaml((node as Yaml).value, ctx.tags);
      break;
    case 'listItem': 
      parseListItemNode(node as ListItem, ctx, curr_task, curr_wlog); 
      break;
    case 'text':
      parseTextNode(node as Text, ctx, curr_task, curr_wlog);
      break;
    case 'heading':
      parseHeadingNode(node as Heading, ctx, curr_task, curr_wlog);
      break;
    default:
      if ('children' in node) {
        parseParentNode(node as Parent, ctx, curr_task, curr_wlog);
      }
  }
};

const from_markdown_opts =  {
  extensions: [frontmatter(['yaml']), gfm()],
  mdastExtensions: [frontmatterFromMarkdown(['yaml']), gfmFromMarkdown()],
};

const DATE_IN_FILENAME_REGEXP = /(?:^|[^\d])(\d{8}|(?:\d{4}-\d{2}-\d{2}))(?:$|[^\d])/;

export const parseFile = async (ctx: ParseFileContext) => {
  ctx.tasks.forEach((task) => {
    if (task.file === ctx.file) {
      ctx.tasks.delete(task);
    }
  });
  ctx.worklogs.forEach((worklog) => {
    if (worklog.file === ctx.file) {
      ctx.worklogs.delete(worklog);
    }
  });
  try {
    const data = await readFile(ctx.file, { encoding: 'utf8' });
    const root_node = fromMarkdown(data, from_markdown_opts);
    const date_match = ctx.file.match(DATE_IN_FILENAME_REGEXP);
    if (date_match) {
      ctx.tags['date'] = date_match[1].replaceAll('-', '');
    }
    parseNode(root_node, ctx, null, null);
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      throw err;
    }
  }
};

const readFolderMetadata = async (ctx: ParseContext, dir_path: string): Promise<TagMap | undefined> => {
  try {
    const target_path = resolve(dir_path, FOLDER_META_FILE);
    const data: any = load(await readFile(target_path, 'utf8'));
    if (typeof data.tags === 'object' && data.tags !== null) {
      return Object.fromEntries(Object.entries(data.tags).map(([k, v]) => [k, String(v)]));
    }
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      throw err;
    }
  }
  return undefined;
};

const parseFolderHelper = async (ctx: ParseContext, target_path: string) => {
  const target_stats = await stat(target_path);
  if (target_stats.isFile() && target_path.endsWith('.md')) {
    const target_rel_path = relative(ctx.folder, target_path);
    await parseFile({ 
      ...ctx, 
      file: target_path,
      internal_tags: { 
        ...ctx.internal_tags, 
        file: target_rel_path,
      },
    });
  } else if (target_stats.isDirectory()) {
    const folder_tags = await readFolderMetadata(ctx, target_path);
    if (folder_tags) {
      ctx = { 
        ...ctx, 
        tags: { 
          ...ctx.tags, 
          ...folder_tags,
        },
      };
    }
    const child_names = await readdir(target_path);
    for (const child_name of child_names) {
      const child_path = resolve(target_path, child_name);
      await parseFolderHelper(ctx, child_path);
    }
  }
};

export const parseFolder = async (folder_path: string): Promise<ParseContext> => {
  const ctx: ParseContext = {
    folder: folder_path,
    tasks: new Set(),
    worklogs: new Set(),
    tags: {},
    internal_tags: {},
  };
  await parseFolderHelper(ctx, folder_path);
  return ctx;
};
