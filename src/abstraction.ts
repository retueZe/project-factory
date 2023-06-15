/** @since v1.0.0 */
export interface ITemplate {
    /** @since v1.0.0 */
    readonly files: readonly Readonly<TemplateFile>[]

    /**
     * Creates pattern used to insert variables in input files. Default behavior:
     * ```
     * variableName -> `<(${variableName})`
     * ```
     * @since v1.0.0
     */
    createInsertionPattern(variableName: string): RegExp | string
    /**
     * Reads input variables used for template scaffolding. Reads variables from prompt by default.
     * @since v1.0.0
     */
    configure(): PromiseLike<Record<string, any>>
    /**
     * Hook, executed before all the FS operations have performed.
     * @param directory directory the template will be scaffolded to; must be absolute
     * @param variables result of a {@link ITemplate.configure} call
     * @since v1.0.0
     */
    onScaffolding(directory: string, variables: Record<string, any>): PromiseLike<void>
    /**
     * Hook, executed after all the FS operations have performed.
     * @param directory directory the template will be scaffolded to; must be absolute
     * @param variables result of a {@link configure} call
     * @since v1.0.0
     */
    onScaffolded(directory: string, variables: Record<string, any>): PromiseLike<void>
}
/** @since v1.0.0 */
export type TemplateFile = {
    /**
     * Relative path, indicating where to scaffold the file.
     * @since v1.0.0
     */
    targetPath: string
    /**
     * Absolute path, indicating where the scaffolding file is located.
     * @since v1.0.0
     */
    sourcePath: string
    /** @since v1.0.0 */
    action: TemplateFileAction
}
/**
 * - `copy` — treat the file as a common file
 * - `copy-inserted` — treat the file as an input file
 * @since v1.0.0
 */
export type TemplateFileAction = 'copy' | 'copy-inserted'
