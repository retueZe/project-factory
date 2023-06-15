import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { exists } from './private/exists.js'

/** @since v1.0.0 */
export type TemplateDeps = Record<string, string>

const TEMPLATE_DEPS_FILE_NAME = 'template.deps.json'

/** @since v1.0.0 */
export async function resolveTemplateDeps(directory: string): Promise<TemplateDeps> {
    const path = resolve(directory, TEMPLATE_DEPS_FILE_NAME)

    if (!(await exists(path))) return {}

    const content = await readFile(path, {encoding: 'utf-8'})
    const deps = JSON.parse(content)

    return deps
}
