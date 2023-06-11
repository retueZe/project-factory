import { resolve } from 'node:path'
import prompts from 'prompts'
import type { TemplateArgs, TemplateConfig } from './Template'

export async function resolveTemplateConfig<I extends Record<string, any> = Record<string, never>, V extends I = I>(
    config: TemplateConfig<I, V>,
    directory?: string | null,
): Promise<TemplateArgs<I, V>> {
    directory ??= null
    const args0 = 'then' in config
        ? await config
        : config
    const args1 = Array.isArray(args0)
        ? args0
        : [args0]

    if (args1.length < 0.5) throw new Error('No templates provided.')

    const args = args1.length < 1.5
        ? args1[0]
        : await chooseTemplateArgs(args1)

    if (directory !== null) args.directory = resolve(args.directory ?? '.', directory)

    return args
}
async function chooseTemplateArgs(args: readonly TemplateArgs<any, any>[]): Promise<TemplateArgs<any, any>> {
    let cancelled = false
    const {argsIndex} = await prompts({
        name: 'argsIndex',
        type: 'select',
        message: 'Select template:',
        choices: args.map((arg, i) => ({
            title: arg.name,
            value: i
        }))
    }, {onCancel: () => cancelled = true})

    if (cancelled) throw new Error('No template was chosen.')

    return args[argsIndex]
}
