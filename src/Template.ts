import type { ITemplate, TemplateFile, TemplateFileAction } from './abstraction.js'
import prompts from 'prompts'
import { readdir } from './private/readdir.js'
import { relative, resolve } from 'node:path'
import { IgnorePatternList } from './private/IgnorePatternList.js'

/** @since v1.0.0 */
export type TemplateArgs<I extends Record<string, any> = any, V extends I = I> = {
    /**
     * Directory of template files. If this directory is relative:
     * - if using configuration files, before being passed to {@link createTemplate}, should be resolved from the directory where the configuration is located;
     * - otherwise, will be resolved from the CWD.
     * @since v1.0.0
     */
    directory?: string | null
    /**
     * `.gitignore`-like ignore patterns. By default, following patterns are included implicitly:
     * ```gitignore
     * template.js
     * template.[cm]js
     * template.deps.json
     * ```
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
    promptScript?: Iterable<Readonly<PromptObject<I>>> | null
    /**
     * Hook, executed after prompt input was successfully received. Allows to process the input before being passed to the input files.
     * @since v1.0.0
     */
    onPromptSubmit?: PromptSubmitCallback<I, V> | null
    /**
     * @see {@link Template.onInstalling}
     * @since v1.0.0
     */
    onInstalling?: InstallProcessCallback<V> | null
    /**
     * @see {@link Template.onInstalled}
     * @since v1.0.0
     */
    onInstalled?: InstallProcessCallback<V> | null
}
type PromptObject<V extends Record<string, any> = any> =
    prompts.PromptObject<Extract<keyof V, string>>
/** @since v1.0.0 */
export type PromptSubmitCallback<I extends Record<string, any> = any, V extends I = I> =
    (input: I) => PromiseLike<V>
/** @since v1.0.0 */
export type InstallProcessCallback<V extends Record<string, any> = any> =
    (directory: string, variables: V) => PromiseLike<void>

/** @since v1.0.0 */
export class Template<I extends Record<string, any> = any, V extends I = I> implements ITemplate<V> {
    static readonly DEFAULT_INSERTION_PATTERN = '<($)'
    private readonly _directory: string
    // should be `readonly Readonly<PromptObject<I>>[]`, but `prompts` typings are shit
    private readonly _promptScript: Readonly<PromptObject<I>>[]
    private readonly _onPromptSubmit: PromptSubmitCallback<I, V>
    private readonly _insertionPattern: string
    private readonly _onInstalling: InstallProcessCallback<V> | null
    private readonly _onInstalled: InstallProcessCallback<V> | null
    readonly files: readonly Readonly<TemplateFile>[]

    private constructor(
        args: Readonly<TemplateArgs<I, V>>,
        files: Iterable<string>
    ) {
        this._directory = resolve(args.directory ?? '.')
        const inputFileExtension = args.inputFileExtension ?? '.in'
        const adaptedFiles: Readonly<TemplateFile>[] = []

        for (const file of files) {
            const action: TemplateFileAction = file.endsWith(inputFileExtension)
                ? 'copy-inserted'
                : 'copy'
            const relativePath = relative(this._directory, file)
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
        const promptScript = args.promptScript
        this._promptScript = typeof promptScript === 'undefined' || promptScript === null
            ? []
            : [...promptScript]
        this._onPromptSubmit = args.onPromptSubmit ?? Template._defaultPromptSubmitCallback
        this._onInstalling = args.onInstalling ?? null
        this._onInstalled = args.onInstalled ?? null
    }

    private static _defaultPromptSubmitCallback(this: void, input: any): Promise<any> {
        return Promise.resolve(input)
    }
    /**
     * Should use {@link createTemplate}.
     * @since v1.0.0
     */
    static async create<I extends Record<string, any> = any, V extends I = I>(
        args: Readonly<TemplateArgs<I, V>>
    ): Promise<Template<I, V>> {
        const directory = resolve(args.directory ?? '.')
        const ignorePatterns = new IgnorePatternList(args.ignorePatterns)
        const files: string[] = []

        for await (const file of readdir(directory, {recursive: true})) {
            if (ignorePatterns.test(file, directory)) continue

            files.push(file)
        }

        return new Template(args, files)
    }
    createInsertionPattern(variableName: string): string | RegExp {
        return this._insertionPattern.replace('$', variableName)
    }
    async configure(): Promise<V> {
        let cancelled = false

        const input = await prompts(this._promptScript, {
            onCancel: () => cancelled = true
        })

        if (cancelled) throw new Error('')

        return await this._onPromptSubmit(input as any)
    }
    onInstalling(directory: string, variables: V): PromiseLike<void> {
        return this._onInstalling === null
            ? Promise.resolve()
            : this._onInstalling(directory, variables)
    }
    onInstalled(directory: string, variables: V): PromiseLike<void> {
        return this._onInstalled === null
            ? Promise.resolve()
            : this._onInstalled(directory, variables)
    }
}
/** @since v1.0.0 */
export function createTemplate<I extends Record<string, any> = any, V extends I = I>(
    args: Readonly<TemplateArgs<I, V>>
): Promise<Template<I, V>> {
    return Template.create(args)
}
