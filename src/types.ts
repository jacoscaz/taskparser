
export type TagMap = Record<string, string>;

export type InternalTag = 'hours' | 'checked' | 'file' | 'line' | 'text';

export type InternalTagMap = Partial<Record<InternalTag, string>>;

export interface Item {
  tags: TagMap;
  internal_tags: InternalTagMap;
  file: string;  
}

export interface Task extends Item {
  worklogs: Worklog[];
}

export interface Worklog extends Item {
  task: Task | null;
}

export type TaskSet = Set<Task>;

export type WorklogSet = Set<Worklog>;

export interface BaseTagExpression {
  tag: string;
}

export interface TagFilterExpression extends BaseTagExpression {
  operator: '=' | '!=' | '^=' | '$=' | '<' | '>' | '>=' | '<=' | '*=' | 'is' | 'not';
  reference: 'null' | string;
}

export interface TagSortExpression extends BaseTagExpression {
  order: 'asc' | 'desc';
}

export interface RenderOpts {
  /** terminal width (number of char columns) */
  terminal_width: number;
}

export interface RenderItemsFn {
  (items: Item[], show_tags: string[], opts: RenderOpts): void;
}

export interface ParseContext {
  folder: string;
  tasks: TaskSet;
  worklogs: WorklogSet;
}

export interface ParseFileContext extends ParseContext {
  file: string;
  tags: TagMap;
  internal_tags: InternalTagMap;
}
