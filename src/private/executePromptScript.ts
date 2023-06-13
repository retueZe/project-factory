import prompts, { PromptObject } from 'prompts'

export async function executePromptScript(script: Readonly<PromptObject>[]): Promise<Record<string, any>> {
    let cancelled = false

    const input = await prompts(script, {
        onCancel: () => cancelled = true
    })

    if (cancelled) throw new Error('Prompt dialogue has been cancelled.')

    return input
}
