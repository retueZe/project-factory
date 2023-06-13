import { resolve } from 'node:path'
import prompts from 'prompts'
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
    routes: readonly Readonly<TemplateRoute>[],
    /** @since v1.0.0 */
    message?: string | null
    /** @since v1.0.0 */
    sharedDirectories?: Iterable<string> | null
}
/** @since v1.0.0 */
export type TemplateRoute = string | {
    directory: string
    message?: string | null
}

const TEMPATE_CONFIG_FILE_NAMES: readonly string[] = [
    'template.js',
    'template.cjs',
    'template.mjs'
]

export async function resolveTemplateConfig(directory: string): Promise<TemplateArgs> {
    const config = await importTemplateConfig(directory)

    if ('routes' in config) return await resolveTemplateRouterConfig(directory, config)

    const resolvedDirectories: string[] = []

    if (typeof config.directories !== 'undefined' && config.directories !== null)
        for (const subdirectory of config.directories)
            resolvedDirectories.push(resolve(directory, subdirectory))
    if (!(config.ignoreCurrentDirectory ?? false)) {
        config.ignoreCurrentDirectory = true
        resolvedDirectories.push(resolve(directory))
    }

    config.directories = resolvedDirectories

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
async function resolveTemplateRouterConfig(directory: string, config: TemplateRouterConfig): Promise<TemplateArgs> {
    if (config.routes.length < 0.5) return {}

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
    const routedConfig = await resolveTemplateConfig(routeDirectory)

    if (typeof config.sharedDirectories !== 'undefined' && config.sharedDirectories !== null) {
        const resolvedSharedDirectories: string[] = []

        for (const subdirectory of config.sharedDirectories)
            resolvedSharedDirectories.push(resolve(directory, subdirectory))

        routedConfig.directories = [
            ...routedConfig.directories ?? [],
            ...resolvedSharedDirectories
        ]
    }

    return routedConfig
}
