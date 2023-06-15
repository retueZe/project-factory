import { execaCommand } from 'execa'
import { randomUUID } from 'node:crypto'
import type { Dir } from 'node:fs'
import { copyFile, mkdir, opendir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { resolveTemplateDeps } from '../TemplateDeps.js'
import { importModule } from './importModule.js'

export async function prepareExecutionContext(directory: string): Promise<[string, () => Promise<void>]> {
    let temporaryDirectory: string | null = null
    let temporaryDirectoryHandle: Dir | null = null

    try {
        temporaryDirectory = resolve(tmpdir(), randomUUID())
        await mkdir(temporaryDirectory)
        temporaryDirectoryHandle = await opendir(temporaryDirectory)
        const deps = await resolveTemplateDeps(directory)
        const packageJson = {
            type: 'module',
            dependencies: deps
        }
        await writeFile(
            join(temporaryDirectory, 'package.json'),
            JSON.stringify(packageJson),
            {encoding: 'utf-8'})

        const depNames = Object.keys(deps)

        if (depNames.length > 0.5) await execaCommand('npm i', {
            cwd: temporaryDirectory,
            stderr: 'inherit'
        })

        return [
            temporaryDirectory,
            async () => {
                if (temporaryDirectoryHandle !== null)
                    await temporaryDirectoryHandle.close()
                if (temporaryDirectory !== null)
                    await rm(temporaryDirectory, {recursive: true, force: true})
            }
        ]
    } catch (error) {
        if (temporaryDirectoryHandle !== null)
            await temporaryDirectoryHandle.close()
        if (temporaryDirectory !== null)
            await rm(temporaryDirectory, {recursive: true, force: true})

        throw error
    }
}
export async function executeInContext(directory: string, scriptPath: string): Promise<any> {
    const copiedScriptPath = resolve(directory, randomUUID() + '.js')
    await copyFile(scriptPath, copiedScriptPath)
    const module = await importModule(copiedScriptPath)
    await rm(copiedScriptPath, {force: true})

    return module
}
