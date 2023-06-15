# `project-factory` & `create-by-template`

First package is a library containing the core of the initializer. Second one provides a CLI executable compatible with `npm init`.

## Usage

```shell
npm init by-template <template-specification> [<scaffold-directory>]
```

Examples of `<template-specification>` (some templates of mine):

- `npm-package`
- `github:project-factory-templates/npm-package` (same as the previous one)
- `npm:example` (supports full `npm install` syntax)
- `https://example.net/`
- `file:../my-local-template`

The default value of `<scaffold-directory>` is `.` (refers to the CWD). The input is received via [`prompts`](https://npmjs.com/prompts).

## Examples

```shell
npm init by-template npm-package my-package
```

To scaffold a template project use:

```shell
npm init by-template template-base my-template
```

## Creating custom templates

To create a custom template take a look at [my ones](https://github.com/project-factory-templates). Here's an example:

```plain
./
├── js/
│   └── index.js.in
├── ts/
│   ├── index.ts.in
│   └── template.js
├── shared/
│   └── README.md
├── template.js
└── template.deps.json
```

The `template.js` and `template.deps.json` files are ignored by default. `template.js` may be either a regular configuration file or a router configuration file.

`./template.js`
```javascript
import chalk from 'chalk'

export default {
    routes: [
        {
            directory: 'js'
            message: chalk.yellow('JavaScript')
        },
        {
            directory: 'ts',
            message: chalk.blue('TypeScript')
        }
    ],
    // https://www.npmjs.com/prompts
    message: 'Select a language:',
    promptScript: [
        {
            // this message will be inserted in one of selected index.* files
            name: 'MSG',
            type: 'text',
            message: 'Enter a message:'
        }
    ]
    sharedDirectories: ['shared']
}
```
`./template.deps.json`
```json
{
    "chalk": "^5.0.0"
}
```
`./js/index.js.in`
```javascript
console.log('From index.js: <(MSG)')
```
`./ts/index.ts.in`
```javascript
console.log('From index.ts: <(MSG)')
```
`./ts/template.js`
```javascript
import chalk from 'chalk'

export default {
    onScaffolded: () => console.log(chalk.red('deps are shared across the configs'))
}
```

The input file extension and variable insertion pattern are overridable. If you'd like to see the full list of options this library provides, you may visit my [GitHub repository](https://github.com/retueZe/project-factory/blob/master/src/TemplateConfig.ts#L12).

## Quicknotes about execution context

The term "execution context" is used to describe an environment the configurations will be executed in. In current implementation, the library creates a temporary directory (roughly, `${tmpdir()}/${randomUUID()}`), installs there all the deps. Done, the execution context is created. To execute a script, the library copies the configuration (roughly, `${temporaryDirectory}/${randomUUID()}.js`, to prevent `import`-caching) and imports it, just to execute. The execution context is destroyed (the temporary directory handle is closed, the directory is deleted) once the template configuration has been resolved.
