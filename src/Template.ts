import type { ITemplate, TemplateFile, TemplateFileAction } from './abstraction'
import prompts from 'prompts'
import { readdir } from './private/readdir'
import { relative, resolve } from 'node:path'
import { IgnorePatternList } from './private/IgnorePatternList'

export type TemplateArgs<I extends Record<string, any> = Record<string, never>, V extends I = I> = {
    name: string
    directory?: string | null
    ignorePatterns?: Iterable<string> | null
    inputFileExtension?: string | null
    insertionPattern?: string | null
    promptScript?: Iterable<Readonly<PromptObject<I>>> | null
    onPromptSubmit?: PromptSubmitCallback<I, V> | null
    onInstalling?: InstallProcessCallback<V> | null
    onInstalled?: InstallProcessCallback<V> | null
}
export type TemplateConfig<I extends Record<string, any> = Record<string, never>, V extends I = I> =
    | TemplateArgs<I, V>
    | TemplateArgs<I, V>[]
    | PromiseLike<TemplateArgs<I, V> | TemplateArgs<I, V>[]>
type PromptObject<V extends Record<string, any> = Record<string, never>> =
    prompts.PromptObject<Extract<keyof V, string>>
export type PromptSubmitCallback<I extends Record<string, any> = Record<string, never>, V extends I = I> =
    (input: I) => PromiseLike<V>
export type InstallProcessCallback<V extends Record<string, any> = Record<string, never>> =
    (directory: string, variables: V) => PromiseLike<void>

export class Template<I extends Record<string, any> = Record<string, never>, V extends I = I> implements ITemplate<V> {
    static readonly DEFAULT_INSERTION_PATTERN = '<($)'
    private readonly _directory: string
    // should be `readonly Readonly<PromptObject<I>>[]`, but `prompts` typings are shit
    private readonly _promptScript: Readonly<PromptObject<I>>[]
    private readonly _onPromptSubmit: PromptSubmitCallback<I, V>
    private readonly _insertionPattern: string
    private readonly _onInstalling: InstallProcessCallback<V> | null
    private readonly _onInstalled: InstallProcessCallback<V> | null
    readonly name: string
    readonly files: readonly Readonly<TemplateFile>[]

    private constructor(
        args: Readonly<TemplateArgs<I, V>>,
        files: Iterable<string>
    ) {
        this.name = args.name
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
    static async create<I extends Record<string, any> = Record<string, never>, V extends I = I>(
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
export function createTemplate<I extends Record<string, any> = Record<string, never>, V extends I = I>(
    args: Readonly<TemplateArgs<I, V>>
): Promise<Template<I, V>> {
    return Template.create(args)
}
