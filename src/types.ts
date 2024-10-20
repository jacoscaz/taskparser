
export type TagMap = Record<string, string>;

export interface Item {
  tags: TagMap;
  file: string;  
}

export interface Task extends Item {
  worklogs: Worklog[];
}

export interface Worklog extends Item {
  task: Task;
}

export type TaskSet = Set<Task>;

export type WorklogSet = Set<Worklog>;

export interface ParseResult {
  tasks: TaskSet;
  worklogs: WorklogSet;
}

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

export interface RenderItemsFn {
  (items: Item[], show_tags: string[], raw_tags: boolean): string;
}