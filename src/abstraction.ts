export interface ITemplate<V extends Record<string, any> = Record<string, never>> {
    readonly name: string
    readonly files: readonly Readonly<TemplateFile>[]

    createInsertionPattern(variableName: string): RegExp | string
    configure(): PromiseLike<V>
    onInstalling(directory: string, variables: V): PromiseLike<void>
    onInstalled(directory: string, variables: V): PromiseLike<void>
}
export type TemplateFile = {
    targetPath: string
    sourcePath: string
    action: TemplateFileAction
}
export type TemplateFileAction = 'copy' | 'copy-inserted'
