import { resolve } from 'node:path'
import prompts, { PromptObject } from 'prompts'
import { executePromptScript } from './private/executePromptScript.js'
import { exists } from './private/exists.js'
import type { TemplateArgs } from './Template.js'
import { importWithDeps, resolveTemplateDeps } from './TemplateDeps.js'

/**
 * Objects of this type will be read from template configuration files.
 * @since v1.0.0
 */
export type TemplateConfig =
    | TemplateArgs
    | TemplateRouterConfig
    | PromiseLike<TemplateArgs | TemplateRouterConfig>
/** @since v1.0.0 */
export type TemplateRouterConfig = {
    /** @since v1.0.0 */
    routes: readonly Readonly<TemplateRoute>[]
    /** @since v1.0.0 */
    message?: string | null
    /** @since v1.0.0 */
    sharedDirectories?: Iterable<string> | null
    /** @since v1.0.0 */
    variables?: Readonly<Record<string, any>> | null
    /** @since v1.0.0 */
    promptScript?: Iterable<Readonly<PromptObject>> | null
    /** @since v1.0.0 */
    onPromptSubmit?: TemplateRouterPromptSubmitCallback | null
    /** @since v1.0.0 */
    onRouteSubmit?: TemplateRouteSubmitCallback | null
    /** @since v1.0.0 */
    onRouted?: TemplateRoutedCallback | null
}
/** @since v1.0.0 */
export type TemplateRoute = string | {
    directory: string
    message?: string | null
}
/** @since v1.0.0 */
export type TemplateRouterPromptSubmitCallback = (variables: Record<string, any>) => void | PromiseLike<void>
/** @since v1.0.0 */
export type TemplateRouteSubmitCallback =
    (variables: Record<string, any>, directory: string, index: number) => void | PromiseLike<void>
/** @since v1.0.0 */
export type TemplateRoutedCallback = (args: TemplateArgs) => void | PromiseLike<void>

const TEMPATE_CONFIG_FILE_NAMES: readonly string[] = [
    'template.js',
    'template.cjs',
    'template.mjs'
]

export async function resolveTemplateConfig(
    directory: string,
    variables?: Record<string, any> | null
): Promise<TemplateArgs> {
    variables ??= {}
    const config = await importTemplateConfig(directory)

    if ('routes' in config) return await resolveTemplateRouterConfig(directory, config, variables)

    const resolvedDirectories: string[] = []

    if (typeof config.directories !== 'undefined' && config.directories !== null)
        for (const subdirectory of config.directories)
            resolvedDirectories.push(resolve(directory, subdirectory))
    if (!(config.ignoreCurrentDirectory ?? false)) {
        config.ignoreCurrentDirectory = true
        resolvedDirectories.push(resolve(directory))
    }

    config.directories = resolvedDirectories
    Object.assign(variables, config.variables ?? {})
    config.variables = variables

    return config
}
async function importTemplateConfig(directory: string): Promise<TemplateConfig> {
    let absoluteConfigPath: string | null = null

    for (const fileName of TEMPATE_CONFIG_FILE_NAMES) {
        const configPath = resolve(directory, fileName)

        if (!(await exists(configPath))) continue

        absoluteConfigPath = configPath

        break
    }

    if (absoluteConfigPath === null) return {}

    const configDeps = await resolveTemplateDeps(directory)
    const configModule = await importWithDeps(absoluteConfigPath, configDeps)

    return configModule.default
}
async function resolveTemplateRouterConfig(
    directory: string,
    config: TemplateRouterConfig,
    variables: Record<string, any>
): Promise<TemplateArgs> {
    if (config.routes.length < 0.5) return {}

    Object.assign(variables, config.variables ?? {})

    if (typeof config.promptScript !== 'undefined' && config.promptScript !== null) {
        const promptScript = [...config.promptScript]
        const input = await executePromptScript(promptScript)

        if (typeof config.onPromptSubmit === 'function') {
            const result = config.onPromptSubmit(input)

            if (typeof result !== 'undefined') await result
        }

        Object.assign(variables, input)
    }

    let cancelled = false
    const {routeIndex} = config.routes.length < 1.5
        ? {routeIndex: 0}
        : await prompts({
            name: 'routeIndex',
            type: 'select',
            message: config.message ?? 'Select route:',
            choices: config.routes.map((route, i) => ({
                title: typeof route === 'string'
                    ? route
                    : route.message ?? route.directory,
                value: i
            }))
        }, {onCancel: () => cancelled = true})

    if (cancelled) throw new Error('No template was chosen.')

    const route = config.routes[routeIndex]
    const routeDirectory = resolve(directory, typeof route === 'string'
        ? route
        : route.directory)

    if (typeof config.onRouteSubmit === 'function') {
        const result = config.onRouteSubmit(variables, routeDirectory, routeIndex)

        if (typeof result !== 'undefined') await result
    }

    const args = await resolveTemplateConfig(routeDirectory, variables)

    if (typeof config.sharedDirectories !== 'undefined' && config.sharedDirectories !== null) {
        const resolvedSharedDirectories: string[] = []

        for (const subdirectory of config.sharedDirectories)
            resolvedSharedDirectories.push(resolve(directory, subdirectory))

        args.directories = [
            ...args.directories ?? [],
            ...resolvedSharedDirectories
        ]
    }
    if (typeof config.onRouted !== 'undefined' && config.onRouted !== null) {
        const result = config.onRouted(args)

        if (typeof result !== 'undefined') await result
    }

    return args
}
