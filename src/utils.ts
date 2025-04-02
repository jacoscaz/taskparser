
export const isNullish = (v: any) => {
  return typeof v === 'undefined' || v === null || v === '';
};

export const FOLDER_META_FILE = '.taskparser.yaml';

export const SPACE = ' ';

export const normalizeWhitespace = (text: string) => {
  return text.trim().replaceAll(/\s+/g, SPACE);
};

export const joinMergeWhitespace = (a: string, b: string) => {
  return `${a.trim()}${SPACE}${b.trim()}`.trim();
};

export const DATE_REGEXP = /(?:^|[^\d])(\d{8}|(?:\d{4}-\d{2}-\d{2}))(?:$|[^\d])/;
