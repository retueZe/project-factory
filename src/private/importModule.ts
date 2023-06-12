import { dirname, isAbsolute, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

export function importModule(path: string): Promise<any> {
    let importPath = relative(dirname(__filename), path)
        .replaceAll('\\', '/')

    if (isAbsolute(importPath)) importPath = 'file://' + importPath

    return import(importPath)
}
