# `project-factory` & `create-by-template`

First package is a library containing the core of the initializer. Second one provides a CLI executable compatible with `npm init`.

## Usage

```shell
npm init by-template <template-specification> [<install-directory>]
```

Examples of `<template-specification>` (some templates of mine):

- `npm-package`
- `github:project-factory-templates/npm-package` (same as the previous one)
- `npm:example` (supports full `npm install` syntax)
- `https://example.net/`
- `file:../my-local-template`

The default value of `<install-directory>` is `.` (refers to the CWD). The input is received via [`prompts`](https://npmjs.com/prompts).

### Creating custom templates

To create a custom template take a look at [my ones](https://github.com/project-factory-templates). The config file should be named `template.mjs` (or `template.js` for pure ESM modules), containing a default export of [`TemplateConfig`](https://github.com/retueZe/project-factory/blob/master/src/Template.ts#L72), but it's also optional (no configuration implies to exporting `{}`). The API supports input files (`*.in` files by default), directory routing (for example, you may want to have a template for both JS and TS, but them into one directory makes things hard to manage, so, routing comes to help), `.gitignore`-like ignore patterns, hooks, etc. If you'd like to suggest or offer some functionality, you're always welcome [here](https://github.com/retueZe/project-factory/issues).

## Examples

```shell
npm init by-template npm-package my-package
```
