import type { ITemplate, TemplateFile, TemplateFileAction } from './abstraction'
import * as prompts from 'prompts'
import { readdir } from './private/readdir'
import * as execa from 'execa'
import { join, relative, resolve } from 'node:path'
import { toAbsolute } from './private/toAbsolute'
import { exists } from './private/exists'

export type TemplateArgs<I extends Record<string, any> = Record<string, never>, V extends I = I> = {
    name: string
    directory?: string | null
    inputFileExtension?: string | null
    insertionPattern?: string | null
    promptScript?: Iterable<Readonly<PromptObject<I>>> | null
    onPromptSubmit?: PromptSubmitCallback<I, V> | null
    prioritizeBashScripts?: boolean | null
    bashScriptShell?: string | null
    batchScriptShell?: string | null
    bashScriptExtension?: string | null
    batchScriptExtension?: string | null
}
export type TemplateConfig<I extends Record<string, any> = Record<string, never>, V extends I = I> =
    | TemplateArgs<I, V>
    | TemplateArgs<I, V>[]
    | PromiseLike<TemplateArgs<I, V> | TemplateArgs<I, V>[]>
type PromptObject<V extends Record<string, any> = Record<string, never>> =
    prompts.PromptObject<Extract<keyof V, string>>
export type PromptSubmitCallback<I extends Record<string, any> = Record<string, never>, V extends I = I> =
    (input: I) => PromiseLike<V>
type ShellName = 'bash' | 'batch'
type ScriptName = 'oninstalling' | 'oninstalled'

export class Template<I extends Record<string, any> = Record<string, never>, V extends I = I> implements ITemplate<V> {
    static readonly DEFAULT_INSERTION_PATTERN = '<($)'
    static readonly DEFAULT_BASH_SCRIPT_SHELL = 'bash'
    static readonly DEFAULT_BATCH_SCRIPT_SHELL = 'cmd'
    static readonly DEFAULT_BASH_SCRIPT_EXTENSION = '.sh'
    static readonly DEFAULT_BATCH_SCRIPT_EXTENSION = '.bat'
    private readonly _templateDirectory: string
    private readonly _scriptDirectory: string
    // should be `readonly Readonly<PromptObject<I>>[]`, but `prompts` typings are shit
    private readonly _promptScript: Readonly<PromptObject<I>>[]
    private readonly _onPromptSubmit: PromptSubmitCallback<I, V>
    private readonly _insertionPattern: string
    private readonly _shells: readonly ShellName[]
    private readonly _bashScriptShell: string
    private readonly _batchScriptShell: string
    private readonly _bashScriptExtension: string
    private readonly _batchScriptExtension: string
    readonly name: string
    readonly files: readonly Readonly<TemplateFile>[]

    private constructor(
        args: Readonly<TemplateArgs<I, V>>,
        files: Iterable<string>,
        canExecuteBashScripts: boolean,
        canExecuteBatchScripts: boolean
    ) {
        this.name = args.name
        const directory = toAbsolute(args.directory ?? '.')
        this._templateDirectory = join(directory, 'template')
        this._scriptDirectory = join(directory, 'scripts')
        const inputFileExtension = args.inputFileExtension ?? '.in'
        const adaptedFiles: Readonly<TemplateFile>[] = []

        for (const file of files) {
            const action: TemplateFileAction = file.endsWith(inputFileExtension)
                ? 'copy-inserted'
                : 'copy'
            const relativePath = relative(this._templateDirectory, file)
            adaptedFiles.push({
                targetPath: action === 'copy-inserted'
                    ? relativePath.slice(0, relativePath.length - inputFileExtension.length)
                    : relativePath,
                sourcePath: file,
                action
            })
        }

        this.files = adaptedFiles
        const promptScript = args.promptScript
        this._promptScript = typeof promptScript === 'undefined' || promptScript === null
            ? []
            : [...promptScript]
        this._onPromptSubmit = args.onPromptSubmit ?? Template._defaultPromptSubmitCallback
        this._insertionPattern = args.insertionPattern ?? Template.DEFAULT_INSERTION_PATTERN
        const prioritizeBashScripts = args?.prioritizeBashScripts ?? false
        this._shells = canExecuteBashScripts
            ? canExecuteBatchScripts
                ? prioritizeBashScripts
                    ? ['bash', 'batch']
                    : ['batch', 'bash']
                : ['bash']
            : canExecuteBatchScripts
                ? ['batch']
                : []
        this._bashScriptShell = args.bashScriptShell ?? Template.DEFAULT_BASH_SCRIPT_SHELL
        this._batchScriptShell = args.batchScriptShell ?? Template.DEFAULT_BATCH_SCRIPT_SHELL
        this._bashScriptExtension = args.bashScriptExtension ?? Template.DEFAULT_BASH_SCRIPT_EXTENSION
        this._batchScriptExtension = args.batchScriptExtension ?? Template.DEFAULT_BATCH_SCRIPT_EXTENSION
    }

    private static _defaultPromptSubmitCallback(this: void, input: any): Promise<any> {
        return Promise.resolve(input)
    }
    static async create<I extends Record<string, any> = Record<string, never>, V extends I = I>(
        args: Readonly<TemplateArgs<I, V>>
    ): Promise<Template<I, V>> {
        const templateDirectory = resolve(toAbsolute(args.directory ?? '.'), 'template')
        const files: string[] = []

        for await (const file of readdir(templateDirectory, {recursive: true}))
            files.push(file)

        const bashScriptShell = args.bashScriptShell ?? this.DEFAULT_BASH_SCRIPT_SHELL
        const canExecuteBashScripts = await shellExists(bashScriptShell + ' --version')
        const canExecuteBatchScripts = process.platform === 'win32'

        return new Template(args, files, canExecuteBashScripts, canExecuteBatchScripts)
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
    private _getScriptPath(shell: ShellName, scriptName: ScriptName): string {
        let scriptPath = resolve(this._scriptDirectory, scriptName + (shell === 'bash'
            ? this._bashScriptExtension
            : this._batchScriptExtension))

        if (shell === 'bash') scriptPath = scriptPath.replaceAll('\\', '/')

        return scriptPath
    }
    async _executeScript(scriptName: ScriptName, directory: string, variables: V): Promise<void> {
        let shell: ShellName | null = null
        let scriptPath: string | null = null

        for (const expectedShell of this._shells) {
            const expectedScriptPath = this._getScriptPath(expectedShell, scriptName)

            if (!(await exists(expectedScriptPath))) continue

            shell = expectedShell
            scriptPath = expectedScriptPath

            break
        }

        if (scriptPath === null) return

        const env: Record<string, string> = {
            TEMPLATEDIR: this._templateDirectory,
            SCRIPTDIR: this._scriptDirectory,
            INSTALLDIR: directory
        }

        for (const name in variables)
            env[name] = String(variables[name])

        await execa(scriptPath, {
            cwd: directory,
            env,
            shell: shell === 'bash' ? this._bashScriptShell : this._batchScriptShell,
            stdout: 'inherit',
            stderr: 'inherit'
        })
    }
    onInstalling(directory: string, variables: V): Promise<void> {
        return this._executeScript('oninstalling', directory, variables)
    }
    onInstalled(directory: string, variables: V): Promise<void> {
        return this._executeScript('oninstalled', directory, variables)
    }
}
export function template<I extends Record<string, any> = Record<string, never>, V extends I = I>(
    args: Readonly<TemplateArgs<I, V>>
): Promise<Template<I, V>> {
    return Template.create(args)
}
async function shellExists(command: string): Promise<boolean> {
    try {
        await execa.command(command)

        return true
    } catch (error: any) {
        if (typeof error === 'object' && error !== null && error.command === command)
            return false

        throw error
    }
}
