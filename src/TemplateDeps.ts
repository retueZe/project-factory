import { execa } from 'execa'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, opendir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { importModule } from './private/importModule.js'
import { exists } from './private/exists.js'
import { Dir } from 'node:fs'

export type TemplateDeps = Record<string, string>

const TEMPLATE_DEPS_FILE_NAME = 'template.deps.json'
const DEPENDENCIES_PROPERTY_NAME = 'dependencies'

export async function resolveTemplateDeps(directory: string): Promise<TemplateDeps> {
    const path = resolve(directory, TEMPLATE_DEPS_FILE_NAME)

    if (!(await exists(path))) return {}

    const content = await readFile(path, {encoding: 'utf-8'})
    const deps = JSON.parse(content)

    return deps
}
export async function importWithDeps(path: string, deps: Readonly<TemplateDeps>): Promise<any> {
    let directory: string | null = null
    let directoryHandle: Dir | null = null

    try {
        directory = join(tmpdir(), randomUUID())
        await mkdir(directory)
        directoryHandle = await opendir(directory)

        return await importWithDepsCore(directory, path, deps)
    } finally {
        if (directoryHandle !== null)
            await directoryHandle.close()
        if (directory !== null)
            await rm(directory, {recursive: true, force: true})
    }
}
async function importWithDepsCore(directory: string, path: string, deps: Readonly<TemplateDeps>): Promise<any> {
    const packageJson = {
        [DEPENDENCIES_PROPERTY_NAME]: deps
    }
    const serializedPackageJson = JSON.stringify(packageJson)

    await writeFile(join(directory, 'package.json'), serializedPackageJson, {encoding: 'utf-8'})

    const depNames = Object.keys(deps)

    if (depNames.length > 0.5) {
        await execa('npm', [
            'i',
            ...depNames
        ], {
            cwd: directory,
            stderr: 'inherit'
        })
    }

    const copiedScriptPath = join(directory, 'main.mjs')

    await copyFile(path, copiedScriptPath)

    return await importModule(copiedScriptPath)
}
