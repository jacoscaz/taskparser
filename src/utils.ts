
export const isNullish = (v: any) => {
  return typeof v === 'undefined' || v === null || v === '';
};

export const FOLDER_META_FILE = '.taskparser.yaml';
