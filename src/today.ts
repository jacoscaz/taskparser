
import slug from 'slug';
import { EOL } from 'os';

const renderTodayFileData = (date: string, title: string): string => {
  return [
    '---',
    '---',
    '',
    `# ${date} | ${title}`,
    '',
    '## Worklogs',
    '',
    '## Notes',
    '',
  ].join(EOL);
}

export const renderTodayFile = (date: Date, title: string): { f_name: string; f_data: string; } => {
  const f_date = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
  const f_slug = slug(title);
  const f_name = `${f_date}-${f_slug}.md`;
  const f_data = renderTodayFileData(f_date, title);
  return { f_name, f_data };
};
