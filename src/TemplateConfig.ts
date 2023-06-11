import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import prompts from 'prompts'
import { exists } from './private/exists.js'
import type { TemplateArgs } from './Template.js'

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
}
/** @since v1.0.0 */
export type TemplateRoute = {
    directory: string
    message?: string | null
}

const TEMPATE_CONFIG_FILE_NAMES: readonly string[] = [
    'template.js',
    'template.cjs',
    'template.mjs'
]
const __filename = fileURLToPath(import.meta.url)

export async function resolveTemplateConfig(directory: string): Promise<TemplateArgs> {
    const config = await importTemplateConfig(directory)

    if ('routes' in config) return await resolveTemplateRouterConfig(directory, config)

    config.directory = resolve(directory, config.directory ?? '.')

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

    const importConfigPath = relative(dirname(__filename), absoluteConfigPath)
        .replaceAll('\\', '/')

    return (await import(importConfigPath)).default
}
async function resolveTemplateRouterConfig(directory: string, config: TemplateRouterConfig): Promise<TemplateArgs> {
    let cancelled = false
    const {routeIndex} = await prompts({
        name: 'routeIndex',
        type: 'select',
        message: config.message ?? 'Select route:',
        choices: config.routes.map((route, i) => ({
            title: route.message ?? route.directory,
            value: i
        }))
    }, {onCancel: () => cancelled = true})

    if (cancelled) throw new Error('No template was chosen.')

    const route = config.routes[routeIndex]
    const routeDirectory = resolve(directory, route.directory)

    return await resolveTemplateConfig(routeDirectory)
}