import { resolve } from 'node:path'
import prompts, { PromptObject } from 'prompts'
import { executePromptScript } from './private/executePromptScript.js'
import { exists } from './private/exists.js'
import { executeInContext, prepareExecutionContext } from './private/prepareExecutionContext.js'
import { TemplateArgs } from './Template.js'

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
    /**
     * If length is 0, throws an error. If length is 1, instantly routes to the only route. Otherwise, prompt `'select'` menu pops up.
     * @since v1.0.0
     */
    routes: readonly Readonly<TemplateRoute>[]
    /**
     * Message for the router's `'select'` prompt.
     * @since v1.0.0
     */
    message?: string | null
    /**
     * If {@link TemplateArgs.inputFileExtension} is not specified in the resolved configuration, then this one will be used.
     * @since v1.0.0
     */
    inputFileExtension?: string | null
    /**
     * If {@link TemplateArgs.insertionPattern} is not specified in the resolved configuration, then this one will be used.
     * @since v1.0.0
     */
    insertionPattern?: string | null
    /**
     * Directories that will be included to {@link TemplateArgs.directories} property. Relative paths will be resolved relative to router configuration location.
     * @since v1.0.0
     */
    sharedDirectories?: Iterable<string> | null
    /**
     * Object that will be assigned to variables record.
     * @since v1.0.0
     */
    variables?: Readonly<Record<string, any>> | null
    /**
     * Additional prompt script executing before the router's `'select'` menu pops up.
     * @since v1.0.0
     */
    promptScript?: Iterable<Readonly<PromptObject>> | null
    /**
     * Executes after {@link TemplateRouterConfig.promptScript} succeeds.
     * @since v1.0.0
     */
    onPromptSubmit?: TemplateRouterPromptSubmitCallback | null
    /**
     * Executes before resolving the route's configuration.
     * @since v1.0.0
     */
    onResolving?: TemplateRouteResolvingCallback | null
    /**
     * Executes after the route's configuration has been resolved.
     * @since v1.0.0
     */
    onResolved?: TemplateRouteResolvedCallback | null
}
/** @since v1.0.0 */
export type TemplateRoute = string | {
    /**
     * Where the router should look for the route's configuration. Relative to the router's location.
     * @since v1.0.0
     */
    directory: string
    /**
     * `'select'` prompt message. Might be colored like
     * ```javascript
     * {
     *     directory: 'js'
     *     message: chalk.yellow`JavaScript`
     * }
     * ```
     */
    message?: string | null
    /**
     * Tag that will be passed to {@link TemplateRouterConfig.onResolving} and {@link TemplateRouterConfig.onResolved}. If it is not presented, {@link TemplateRoute.directory} is used instead. The purpose of tags is to identify routes among each other not depending on its directory name or prompt menu position. Multiple tag system implementation:
     * ```javascript
     * {
     *     routes: [
     *         {
     *             directory: 'route'
     *             tag: 'one two three spaces-replaced-by-dashes'
     *         }
     *     ],
     *     onResolved: (args, tag) => {
     *         const tags = new Set(tag.split(' '))
     *         ...
     *     }
     * }
     * ```
     * OR
     * ```javascript
     * {
     *     routes: [
     *         {
     *             directory: 'route'
     *             tag: 'primary secondary-one secondary-two'
     *         }
     *     ],
     *     onResolved: (args, tag) => {
     *         const splittedTag = tag.split(' ')
     *         const primaryTag = splittedTag[0]
     *         const secondaryTags = new Set(splittedTags.slice(1))
     *         ...
     *     }
     * }
     * ```
     */
    tag?: string | null
}
/** @since v1.0.0 */
export type TemplateRouterPromptSubmitCallback = (variables: Record<string, any>) => void | PromiseLike<void>
/** @since v1.0.0 */
export type TemplateRouteResolvingCallback = (variables: Record<string, any>, tag: string) => void | PromiseLike<void>
/** @since v1.0.0 */
export type TemplateRouteResolvedCallback = (args: TemplateArgs, tag: string) => void | PromiseLike<void>

const TEMPATE_CONFIG_FILE_NAME = 'template.js'

/** @since v1.0.0 */
export async function resolveTemplateConfig(
    directory: string,
    variables?: Record<string, any> | null,
    temporaryDirectory?: string | null
): Promise<TemplateArgs> {
    variables ??= {}
    temporaryDirectory ??= null

    if (temporaryDirectory !== null)
        return await resolveTemplateConfigCore(directory, variables, temporaryDirectory)

    let releaseContext: (() => Promise<void>) | null = null

    try {
        const [_temporaryDirectory, _releseContext] = await prepareExecutionContext(directory)
        temporaryDirectory = _temporaryDirectory
        releaseContext = _releseContext

        return await resolveTemplateConfigCore(directory, variables, temporaryDirectory)
    } finally {
        if (releaseContext !== null) await releaseContext()
    }
}
async function resolveTemplateConfigCore(
    directory: string,
    variables: Record<string, any>,
    temporaryDirectory: string
): Promise<TemplateArgs> {
    const config = await importTemplateConfig(directory, temporaryDirectory)

    if ('routes' in config)
        return await resolveTemplateRouterConfig(directory, config, variables, temporaryDirectory)

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
async function importTemplateConfig(directory: string, temporaryDirectory: string): Promise<TemplateConfig> {
    const configPath = resolve(directory, TEMPATE_CONFIG_FILE_NAME)

    if (!(await exists(configPath))) return {}

    const configModule = await executeInContext(temporaryDirectory, configPath)

    return configModule.default
}
async function resolveTemplateRouterConfig(
    directory: string,
    config: TemplateRouterConfig,
    variables: Record<string, any>,
    temporaryDirectory: string
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
            message: config.message ?? 'Select a route:',
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
    const routeTag = typeof route === 'string'
        ? route
        : route.tag ?? routeDirectory

    if (typeof config.onResolving === 'function') {
        const result = config.onResolving(variables, routeTag)

        if (typeof result !== 'undefined') await result
    }

    const args = await resolveTemplateConfig(routeDirectory, variables, temporaryDirectory)
    args.inputFileExtension ??= config.inputFileExtension
    args.insertionPattern ??= config.insertionPattern

    if (typeof config.sharedDirectories !== 'undefined' && config.sharedDirectories !== null) {
        const resolvedSharedDirectories: string[] = []

        for (const subdirectory of config.sharedDirectories)
            resolvedSharedDirectories.push(resolve(directory, subdirectory))

        args.directories = [
            ...args.directories ?? [],
            ...resolvedSharedDirectories
        ]
    }
    if (typeof config.onResolved !== 'undefined' && config.onResolved !== null) {
        const result = config.onResolved(args, routeTag)

        if (typeof result !== 'undefined') await result
    }

    return args
}
