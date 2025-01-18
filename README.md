
# taskparser

A CLI tool to parse tasks and worklogs out of Markdown documents and print
them to standard output in the format of a Markdown table, CSV or JSON.
Supports sorting and filtering based on metadata encoded in tags, inline and/or
as YAML frontmatter.

## Introduction

See the [post on the rationale behind taskparser on my blog][intro].

[intro]: https://treesandrobots.com/2024/10/taskparser-keep-notes-and-tasks-together.html

## Example

Given directory `/foo/bar` with a `20241010-baz.md` file having the following
contents:

```markdown
## Todos

- [ ] a pending task
- [X] a completed task
```

`taskparser` will output the following:

```
$ taskparser /foo/bar
```

```
text             | done  | file            | date
---              | ---   | ---             | ---
a pending task   | false | 20241010-baz.md | 20241010
a completed task | true  | 20241010-baz.md | 20241010
```

## Install

```sh
npm i -g taskparser
```

## Usage

```
$ taskparser -h
usage: taskparser [-h] [-t TAGS] [-f FILTER] [-s SORT] [-w] [-l] [-C] [-U] [-o {table,csv,json}] [-c COLUMNS]
              [-v] [--today] [--title TITLE]
              path

A CLI tool to parse, sort and filter tasks and worklogs out of Markdown documents and print them to
standard output, either in tabular of CSV format.

positional arguments:
  path                  working directory

optional arguments:
  -h, --help            show this help message and exit
  -t TAGS, --tags TAGS  comma-separated list of tags to show
  -f FILTER, --filter FILTER
                        filtering expression such as: foo(=bar)
  -s SORT, --sort SORT  sorting expression such as: foo(asc)
  -w, --watch           enable watch mode
  -l, --worklogs        enable worklogs mode
  -C, --checked         only show checked tasks
  -U, --unchecked       only show unchecked tasks
  -o {table,csv,json}, --out {table,csv,json}
                        set output format
  -c COLUMNS, --columns COLUMNS
                        override detected terminal width (in character columns)
  -v, --version         show program's version number and exit
  --today               generate a new today file at the given path
  --title TITLE         title for the new today file
```

## Tags

`taskparser` uses the concept of _tag_ as the unit of information that
describes tasks and worklogs.

### Choosing which tags to show

The `-t` flag may be used to change which tags are displayed:

```
$ taskparser -t text,project,client,file,date /foo/bar
```

### Autogenerated tags

When parsing tasks, `taskparser` auto-generates the following tags:

| tag | description | internal | 
| --- | --- | --- |
| `text` | the textual content of the task (first line only) | yes |
| `file` | the file that contains the task | yes |
| `date` | the date of creation of the task | no |
| `checked` | whether the task is checked as done | yes |

Auto-genereated tags considered _internal_ cannot be overridden via YAML
frontmatter or inline tags.

When rendering to a Markdown table (i.e. the default output format `table`),
the `checked` tag is shortened to `c` and rendered with a tick mark for
compactness.

### Inline tags

Tasks may be tagged inline:

```markdown 
- [ ] a pending task #project(foo) #client(bar)
- [X] a completed task
```

```
$ taskparser -t text,project,client,file,date /foo/bar
```

```
text                                      | project | client | file            | date
---                                       | ---     | ---    | ---             | ---
a pending task #project(foo) #client(bar) | foo     | bar    | 20241010-foo.md | 20241010
a completed task                          |         |        | 20241010-foo.md | 20241010
```

Tags may also be added after a line break (three consecutive spaces) so that
they are not counted as part of the autogenerated `text` tag:

```markdown 
- [ ] a pending task   
      #project(foo) #client(bar)
- [X] a completed task
```

```
$ taskparser -t text,project,client,file,date /foo/bar
```

```
text             | project | client | file            | date
---              | ---     | ---    | ---             | ---
a pending task   | foo     | bar    | 20241010-foo.md | 20241010
a completed task |         |        | 20241010-foo.md | 20241010
```

### Frontmatter tags

If present, tags will be inherited from any YAML front-matter:

```markdown
---
project: foo
client: bar
---

- [ ] a pending task
- [X] a completed task
```

`taskparser` will produce:

```
$ taskparser -t text,project,client,file,date /foo/bar
```

```
text             | project | client | file            | date
---              | ---     | ---    | ---             | ---
a pending task   | foo     | bar    | 20241010-foo.md | 20241010
a completed task | foo     | bar    | 20241010-foo.md | 20241010
```

### Metadata file tags

If present, tags will be inherited from any per-folder `.taskparser.yaml` files
throughout the folder hierarchy leading to a markdown file:

Tags **must** be expressed through a simple, root-level `tags` dictionary:

```yaml
tags:
  project: foo
  client: bar
```

## Heading tags

If present, tags will be inherited from headings. Each sub-heading may override
tags from parent headings.

```markdown
# #client(foo)

## #project(bar)

- [ ] a pending task

## #project(baz)

- [X] a completed task
```

`taskparser` will produce:

```
$ taskparser -t text,project,client,file,date /foo/bar
```

```
text             | project | client | file            | date
---              | ---     | ---    | ---             | ---
a pending task   | bar     | foo    | 20241010-foo.md | 20241010
a completed task | baz     | foo    | 20241010-foo.md | 20241010
```

### Filtering by tag

`taskparser` accepts filter expression via the `-f` argument:

```shell
$ taskparser -f "client(=foo)" /foo/bar
```

Filtering syntax is as follows:

```
foo(isnull)      matches tasks without tag "foo"
foo(notnull)     matches tasks with tag "foo"
foo(=bar)        matches tasks with tag "foo" set to "bar"
foo(!=bar)       matches tasks with tag "foo" set to anything other than "bar"
foo(^=bar)       matches tasks with tag "foo" starting with "bar"
foo($=bar)       matches tasks with tag "foo" ending with "bar"
foo(*=bar*)      matches tasks with tag "foo" matching the pattern "bar*"
```

Additionally, the following operators may be used to filter tasks based on the
lexicographical ordering of tag values:

```
foo(>=bar)       matches tasks with tag "foo" greater than or equal to "bar"
foo(<=bar)       matches tasks with tag "foo" lower than or equal to "bar"
foo(>bar)        matches tasks with tag "foo" greater than "bar"
foo(<bar)        matches tasks with tag "foo" lower than "bar"
```

Filtering expressions can be combined:

```
foo(=bar),foo(!=baz)
```

### Filtering by checked state

While filtering tasks by their checked state requires comparing against
`"true"` and `"false"`, the `-U, --unchecked` and `-C, --checked` CLI
arguments make for easy-to-remember shortcuts:

```
$ taskparser -f "checked(=false),project(=baz)" /foo/bar
$ taskparser -f "checked(=true),project(=baz)" /foo/bar
```

are equivalent to, respectively:

```
$ taskparser -U -f "project(=baz)" /foo/bar
$ taskparser -C -f "project(=baz)" /foo/bar
```

### Sorting by tag

`taskparser` accepts sorting expressions via the `-s` argument:

```shell
$ taskparser -s "client(asc)" /foo/bar
```

Sorting syntax is as follows:

```
foo(asc)      sorts tasks by the "foo" tag in ascending lexicographical order
foo(desc)     sorts tasks by the "foo" tag in descending lexicographical order
```

Sorting expressions can be combined for nested sorting:

```
foo(asc),bar(desc)
```

## Worklogs

In addition to tasks, `taskparser` can also collect and display _worklogs_.
A worklog is a list item detailing a given amount of hours spent working.

```markdown
- WL:3h this is a simple worklog
```

Worklogs can be tagged, filtered and sorted exactly as tasks. For each worklog
it encounters, `taskparser` automatically generates the following tags:

| tag | description | internal | 
| --- | --- | --- |
| `text` | the textual content of the task (first line only) | yes |
| `file` | the file that contains the task | yes |
| `date` | the date of creation of the task | no |
| `hours` | amount of hours logged | yes |

The `-l` or `--worklogs` flag may be used to enable worklog mode:

```
taskparser -l -t text,hours,file,date
```

When rendering to a Markdown table (i.e. the default output format), the
`hours` tag is shortened to `h` for compactness.

## License

Released under the LGPL v3.0 (`LGPL-3.0-only`) license. See [LICENSE.md][l1].

## Dependencies

This package is published to NPM in bundle form, with no runtime dependencies.

All bundled dependencies are listed in the [DEPENDENCIES.md][l2] file, which
includes version numbers and licenses. This file is generated using the
[`license-report` package][l3] as follows:

```sh
license-report --config license-report-config.json --output=markdown > DEPENDENCIES.md
```

[l1]: ./LICENSE.md
[l2]: ./DEPENDENCIES.md
[l3]: https://www.npmjs.com/package/license-report
