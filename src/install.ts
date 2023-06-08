import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { ITemplate } from './abstraction'
import { dirname, resolve } from 'node:path'
import { exists } from './private/exists'
import { toAbsolute } from './private/toAbsolute'

export async function install<V extends Record<string, any> = Record<string, never>>(
    _directory: string,
    template: ITemplate<V>
): Promise<void> {
    const directory = toAbsolute(_directory)
    const variables = await template.configure()

    if (!await exists(directory)) await mkdir(directory)

    await template.onInstalling(directory, variables)

    for (const {targetPath: relativeTargetPath, sourcePath: absolutePath, action} of template.files) {
        const targetPath = resolve(directory, relativeTargetPath)
        const targetDirectory = dirname(targetPath)

        if (!await exists(targetDirectory)) mkdir(targetDirectory)
        if (action === 'copy') {
            await copyFile(absolutePath, targetPath)

            continue
        }

        let content = await readFile(absolutePath, {encoding: 'utf-8'})

        for (const name in variables) {
            const insertionPattern = template.createInsertionPattern(name)

            content = content.replaceAll(insertionPattern, variables[name])
        }

        await writeFile(targetPath, content, {encoding: 'utf-8'})
    }

    await template.onInstalled(directory, variables)
}
