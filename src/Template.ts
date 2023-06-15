import type { ITemplate, TemplateFile, TemplateFileAction } from './abstraction.js'
import { PromptObject } from 'prompts'
import { readdir } from './private/readdir.js'
import { relative, resolve } from 'node:path'
import { IgnorePatternList } from './private/IgnorePatternList.js'
import { executePromptScript } from './private/executePromptScript.js'

/** @since v1.0.0 */
export type TemplateArgs = {
    /**
     * Extra directories for template files. Paths are relative:
     * - if using configuration files, before being passed to {@link createTemplate}, should be resolved from the directory where the configuration is located;
     * - otherwise, will be resolved from the CWD.
     * @since v1.0.0
     */
    directories?: Iterable<string> | null
    /**
     * By default, the CWD is also applied to resolved directories. This flag can prevent that behavior.
     * @since v1.0.0
     */
    ignoreCurrentDirectory?: boolean | null
    /**
     * `.gitignore`-like ignore patterns. By default, following patterns are included implicitly:
     * ```gitignore
     * template.js
     * template.deps.json
     * ```
     * First of all, files from the provided directories are settled, and only then ignore patterns are applied.
     * @since v1.0.0
     */
    ignorePatterns?: Iterable<string> | null
    /**
     * While using {@link createTemplate}, `null` implies to `'.in'`.
     * @since v1.0.0
     */
    inputFileExtension?: string | null
    /**
     * A regular string, all the `'$'` inside of which will be replaced with `variableName` during {@link Template.createInsertionPattern} execution. While using {@link createTemplate}, `null` implies to `'<($)'`.
     * @since v1.0.0
     */
    insertionPattern?: string | null
    /**
     * Defines initial variables. Subsequently, a copy of this object will be used for variable collection.
     * @since v1.0.0
     */
    variables?: Readonly<Record<string, any>> | null
    /**
     * Prompt objects used in {@link Template.configure} method, names of which will be variable names.
     * @example
     * ```javascript
     * const promptScript = [
     *     {
     *         name: 'PKGNAME', // will be variable name
     *         type: 'text',
     *         message: '...'
     *     }
     * ]
     * ```
     * @since v1.0.0
     */
    promptScript?: Iterable<Readonly<PromptObject>> | null
    /**
     * Hook, executed after prompt input was successfully received. Allows to process the input before being passed to the input files.
     * @since v1.0.0
     */
    onPromptSubmit?: PromptSubmitCallback | null
    /**
     * @see {@link Template.onScaffolding}
     * @since v1.0.0
     */
    onScaffolding?: TemplateScaffoldCallback | null
    /**
     * @see {@link Template.onScaffolded}
     * @since v1.0.0
     */
    onScaffolded?: TemplateScaffoldCallback | null
}
/** @since v1.0.0 */
export type PromptSubmitCallback = (input: Record<string, any>) => void | PromiseLike<void>
/** @since v1.0.0 */
export type TemplateScaffoldCallback = (directory: string, variables: Record<string, any>) => void | PromiseLike<void>

/** @since v1.0.0 */
export class Template implements ITemplate {
    static readonly DEFAULT_INSERTION_PATTERN = '<($)'
    // should be `readonly Readonly<PromptObject<I>>[]`, but `prompts` typings are shit
    private readonly _insertionPattern: string
    private readonly _variables: Readonly<Record<string, any>>
    private readonly _promptScript: Readonly<PromptObject>[]
    private readonly _onPromptSubmit: PromptSubmitCallback
    private readonly _onScaffolding: TemplateScaffoldCallback | null
    private readonly _onScaffolded: TemplateScaffoldCallback | null
    readonly files: readonly Readonly<TemplateFile>[]

    private constructor(
        args: Readonly<TemplateArgs>,
        directories: Iterable<[string, Iterable<string>]>
    ) {
        const inputFileExtension = args.inputFileExtension ?? '.in'
        const adaptedFiles: Readonly<TemplateFile>[] = []

        for (const [directory, files] of directories)
            for (const file of files) {
                const action: TemplateFileAction = file.endsWith(inputFileExtension)
                    ? 'copy-inserted'
                    : 'copy'
                const relativePath = relative(directory, file)
                adaptedFiles.push({
                    targetPath: action === 'copy-inserted'
                        ? relativePath.slice(0, relativePath.length - inputFileExtension.length)
                        : relativePath,
                    sourcePath: file,
                    action
                })
            }

        this.files = adaptedFiles
        this._insertionPattern = args.insertionPattern ?? Template.DEFAULT_INSERTION_PATTERN
        this._variables = args.variables ?? {}
        const promptScript = args.promptScript
        this._promptScript = typeof promptScript === 'undefined' || promptScript === null
            ? []
            : [...promptScript]
        this._onPromptSubmit = args.onPromptSubmit ?? Template._defaultPromptSubmitCallback
        this._onScaffolding = args.onScaffolding ?? null
        this._onScaffolded = args.onScaffolded ?? null
    }

    private static _defaultPromptSubmitCallback(this: void, input: any): Promise<any> {
        return Promise.resolve(input)
    }
    /**
     * Should use {@link createTemplate}.
     * @since v1.0.0
     */
    static async create(args: Readonly<TemplateArgs>): Promise<Template> {
        const directories = []

        if (!(args.ignoreCurrentDirectory ?? false)) directories.push(resolve('.'))
        if (typeof args.directories !== 'undefined' && args.directories !== null)
            for (const directory of args.directories)
                directories.push(resolve(directory))

        const ignorePatterns = new IgnorePatternList(args.ignorePatterns)
        const pairs: [string, Iterable<string>][] = []

        for (const directory of directories) {
            const files: string[] = []
            pairs.push([directory, files])

            for await (const file of readdir(directory, {recursive: true})) {

                if (ignorePatterns.test(file, directory)) continue

                files.push(file)
            }
        }

        return new Template(args, pairs)
    }
    createInsertionPattern(variableName: string): string | RegExp {
        return this._insertionPattern.replace('$', variableName)
    }
    async configure(): Promise<Record<string, any>> {
        const input = {...this._variables}
        Object.assign(input, await executePromptScript(this._promptScript))

        await this._onPromptSubmit(input)

        return input
    }
    onScaffolding(directory: string, variables: Record<string, any>): PromiseLike<void> {
        if (this._onScaffolding === null) return Promise.resolve()

        const result = this._onScaffolding(directory, variables)

        return typeof result === 'undefined'
            ? Promise.resolve()
            : result
    }
    onScaffolded(directory: string, variables: Record<string, any>): PromiseLike<void> {
        if (this._onScaffolded === null) return Promise.resolve()

        const result = this._onScaffolded(directory, variables)

        return typeof result === 'undefined'
            ? Promise.resolve()
            : result
    }
}
/** @since v1.0.0 */
export function createTemplate(args: Readonly<TemplateArgs>): Promise<Template> {
    return Template.create(args)
}
