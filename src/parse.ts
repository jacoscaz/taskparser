
import type { Parent, Node, Yaml, ListItem, Text, Heading, Code } from 'mdast';
import type { TagMap, Task, Worklog, ParseContext, ParseFileContext } from './types.js';

import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { load } from 'js-yaml';

import { gfm } from 'micromark-extension-gfm';
import { frontmatter } from 'micromark-extension-frontmatter';

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';

import { extractTagsFromText, extractTagsFromYaml } from './tags.js';
import { FOLDER_META_FILE, joinMergeWhitespace, normalizeWhitespace, SPACE } from './utils.js';

const WL_REGEXP = /^WL:(\d{1,2}(?:\.\d{1,2})?)[hH]\s/;

const collectTextDepthFirst = (root: Node | undefined, acc: string = ''): string => {
  if (!root) {
    return acc;
  }
  if (root.type === 'text') {
    return joinMergeWhitespace(acc, normalizeWhitespace((root as Text).value));
  } 
  if ('children' in root) {
    return joinMergeWhitespace(acc, (root as Parent).children.map(child => collectTextDepthFirst(child, acc)).join(SPACE));
  }
  return acc;
};

const parseListItemNode = (node: ListItem, ctx: ParseFileContext, item: Task | Worklog | null) => {
  if (!item) {
    const text = collectTextDepthFirst(node);
    if (typeof node.checked === 'boolean') {
      const tags: TagMap = { 
        ...ctx.tags,
        ...ctx.heading?.tags,
        line: String(node.position!.start.line),
        checked: String(node.checked),
      };
      tags.text = extractTagsFromText(text, tags);
      Object.assign(tags, ctx.internal_tags);
      ctx.tasks.add({ type: 'task', tags, file: ctx.file, worklogs: [] });
      return;
    } 
    const wl_match = text.match(WL_REGEXP);
    if (wl_match) {
      const [full, hours] = wl_match;
      const tags: TagMap = { 
        ...ctx.tags,
        ...ctx.heading?.tags,
        hours,
        line: String(node.position!.start.line),
      };
      tags.text = extractTagsFromText(text.slice(full.length), tags);
      Object.assign(tags, ctx.internal_tags);
      ctx.worklogs.add({ type: 'wlog', tags, file: ctx.file, task: item });
      return;
    }
  }
  parseParentNode(node, ctx, item);
};

const parseParentNode = (node: Parent, ctx: ParseFileContext, item: Task | Worklog | null) => {
  node.children.forEach((node) => {
    parseNode(node, ctx, item); 
  });
};

const parseHeadingNode = (node: Heading, ctx: ParseFileContext, item: Task | Worklog | null) => {
  let parent = ctx.heading;
  while (parent && parent.depth > node.depth) {
    parent = parent.parent;
  }
  const tags = parent ? { ...parent.tags } : {};
  const text = collectTextDepthFirst(node);
  extractTagsFromText(text, tags);
  ctx.heading = { depth: node.depth, tags, parent };
};

const parseYamlNode = (node: Yaml, ctx: ParseFileContext, item: Task | Worklog | null) => {
  try {
    extractTagsFromYaml((node as Yaml).value, ctx.tags);
  } catch (err) {
    throw new Error(`could not parse YAML front-matter in file ${ctx.file}: ${(err as Error).message}`);
  }
};

const parseCodeNode = (node: Code, ctx: ParseFileContext, item: Task | Worklog | null) => {
  if (node.lang === 'taskparser' && ctx.heading) {
    try {
      extractTagsFromYaml(node.value, ctx.heading.tags);
    } catch (err) {
      throw new Error(`could not parse YAML code block in file ${ctx.file}: ${(err as Error).message}`);
    }
  }
};

const parseNode = (node: Node, ctx: ParseFileContext, item: Task | Worklog | null) => {
  switch (node.type) {
    case 'yaml': 
      parseYamlNode(node as Yaml, ctx, item);
      break;
    case 'listItem': 
      parseListItemNode(node as ListItem, ctx, item); 
      break;
    case 'heading':
      parseHeadingNode(node as Heading, ctx, item);
      break;
    case 'code':
      parseCodeNode(node as Code, ctx, item);
      break;
    default:
      if ('children' in node) {
        parseParentNode(node as Parent, ctx, item);
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
    parseNode(root_node, ctx, null);
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      throw err;
    }
  }
};

const readFolderMetadata = async (ctx: ParseContext, dir_path: string): Promise<{ tags: TagMap, ignore: boolean }> => {
  const target_path = resolve(dir_path, FOLDER_META_FILE);
  const tags: TagMap = {};
  try {
    const data: any = load(await readFile(target_path, 'utf8')); 
    if (typeof data.tags === 'object' && data.tags !== null) {
      Object.entries(data.tags).forEach(([k, v]) => {
        tags[k] = String(v);
      });
    }
    return { tags, ignore: !!data.ignore };
  } catch (err) {
    if ((err as any).code !== 'ENOENT') {
      throw new Error(`could not parse folder metadata file ${target_path}: ${err as Error}.message`);
    }
    return { tags, ignore: false };
  }
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
    const { tags, ignore } = await readFolderMetadata(ctx, target_path);
    if (!ignore) {
      ctx = { 
        ...ctx, 
        tags: { 
          ...ctx.tags, 
          ...tags,
        },
      };
      const child_names = await readdir(target_path);
      for (const child_name of child_names) {
        const child_path = resolve(target_path, child_name);
        await parseFolderHelper(ctx, child_path);
      }
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
