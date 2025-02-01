
import type { TagMap, TagSortExpression, TagFilterExpression, Item } from './types.js';

import { isMatch } from 'matcher';
import { load } from 'js-yaml';

import { isNullish, joinMergeWhitespace } from './utils.js';

export const TAG_SEARCH_REGEXP = /\#([a-z0-9]+)(?:\(([^),]+)\))/gi;
export const TAG_CHECK_REGEXP = /([a-z0-9]+)(?:\(([^),]+)\))/i;

export const extractTagsFromText = (raw: string, tags: TagMap) => {
  let offset = 0;
  let stripped = '';
  for (const match of raw.matchAll(TAG_SEARCH_REGEXP)) {
    tags[match[1]] = match[2] ?? 'true';
    stripped = joinMergeWhitespace(stripped, raw.slice(offset, match.index));
    offset += match.index + match[0].length;
  }
  stripped = joinMergeWhitespace(stripped, raw.slice(offset));
  return stripped;
};

export const extractTagsFromYaml = (raw: string, tags: TagMap) => {
  const parsed = load(raw);
  if (typeof parsed === 'object' && parsed !== null) {
    for (const [key, value] of Object.entries(parsed)) {
      tags[key] = value;
    }
  }
};

const SORT_REGEXP = /^(asc|desc)$/i

export const parseTagSortExpressions = (raw: string): TagSortExpression[] => {
  return raw.split(',').map((raw_substr) => {
    const tag_match = raw_substr.match(TAG_CHECK_REGEXP);
    if (!tag_match) {
      throw new Error('invalid sort expression: ' + raw_substr);
    }
    const [, tag_name, tag_value] = tag_match;
    const expr_match = tag_value.match(SORT_REGEXP);
    if (!expr_match) {
      throw new Error('invalid sort expression: ' + raw_substr);
    }
    const [, order, parse] = expr_match;
    return { tag: tag_name, order, parse } as TagSortExpression;
  });
};

export type ItemComparator = (a: Item, b: Item) => 1 | 0 | -1;

export const compileTagSortExpressions = (exprs: TagSortExpression[]): ItemComparator => {
  return (a, b) => {
    for (const expr of exprs) {
      const a_lt_b = expr.order === 'asc' ? -1 : 1;
      const a_gt_b = expr.order === 'asc' ? 1 : -1;
      let a_value: string | Date | number | null | undefined = a.tags[expr.tag];
      let b_value: string | Date | number | null | undefined = b.tags[expr.tag];
      if (a_value !== b_value) {
        if (a_value === undefined || a_value === null) return 1;
        if (b_value === undefined || b_value === null) return -1;
        return a_value < b_value ? a_lt_b : a_gt_b;
      }
    }
    return 0;
  };
};

const FILTER_REGEXP = /^([!*$^<>]?=|[<>]|is|not)\s*([a-z0-9*_\-]+)$/i

export const parseTagFilterExpressions = (raw: string): TagFilterExpression[] => {
  return raw.split(',').map((raw_substr) => {
    const tag_match = raw_substr.match(TAG_CHECK_REGEXP);
    if (!tag_match) {
      throw new Error('invalid filter expression: ' + raw_substr);
    }
    const [, tag_name, tag_value] = tag_match;
    const expr_match = tag_value.match(FILTER_REGEXP);
    if (!expr_match) {
      throw new Error('invalid filter expression: ' + raw_substr);
    }
    const [, operator, reference, parse] = expr_match;
    return { tag: tag_name, operator, reference, parse } as TagFilterExpression;
  });
};

export type ItemFilter = (t: Item) => boolean;

export const compileTagFilterExpressions = (exprs: TagFilterExpression[]): ItemFilter => {
  return (t) => {
    for (const expr of exprs) {
      let expr_val: string | Date | number = expr.reference;
      let task_val: string | Date | number | undefined | null = t.tags[expr.tag];
      if (expr.reference === 'null') {
        switch (expr.operator) {
          case 'is': 
            if (isNullish(task_val)) 
              continue; 
            else
              return false;
          case 'not': 
            if (isNullish(task_val)) 
              return false; 
            else
              continue;
          default:
        }
      }
      if (isNullish(task_val)) {
        return false;
      }
      switch (expr.operator) {
        case '=': 
          if (expr_val !== task_val) {
            return false;
          }
          break;
        case '!=':
          if (expr_val === task_val) {
            return false;
          }
          break;
        case '<': 
          if (task_val >= expr_val) {
            return false;
          }
          break;
        case '>': 
          if (task_val <= expr_val) {
            return false;
          }
          break;
        case '<=': 
          if (task_val > expr_val) {
            return false;
          }
          break;
        case '>=': 
          if (task_val < expr_val) {
            return false;
          };
          break;
        case '^=': 
          if (!task_val.startsWith(expr_val)) {
            return false;
          };
          break;
        case '$=': 
          if (!task_val.endsWith(expr_val)) {
            return false;
          };
          break;
        case '*=':
          if (!isMatch(task_val, expr_val)) {
            return false;
          };
          break;
        case 'is': 
          throw new Error('Bad filter expression: cannot use "is" operator with anything else but "null"');
        case 'not': 
          throw new Error('Bad filter expression: cannot use "not" operator with anything else but "null"');
      }
    }
    return true;
  };
};
