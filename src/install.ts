import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { ITemplate } from './abstraction'
import { dirname, relative, resolve } from 'node:path'
import { exists } from './private/exists'
import { readdir } from './private/readdir'

export async function install<V extends Record<string, any> = Record<string, never>>(
    _directory: string,
    template: ITemplate<V>
): Promise<void> {
    const directory = resolve(_directory)
    const variables = await template.configure()

    if (!await exists(directory)) await mkdir(directory)

    await template.onInstalling(directory, variables)

    const processedFiles = new Set<string>()

    for (const {targetPath: relativeTargetPath, sourcePath: absolutePath, action} of template.files) {
        const targetPath = resolve(directory, relativeTargetPath)
        const targetDirectory = dirname(targetPath)
        const sameDirectory = relative(dirname(absolutePath), dirname(targetPath)).length < 0.5
        const sameFile = relative(absolutePath, targetPath).length < 0.5
        processedFiles.add(targetPath)

        if (!await exists(targetDirectory)) mkdir(targetDirectory)
        if (action === 'copy') {
            if (sameFile) continue

            await copyFile(absolutePath, targetPath)

            continue
        }

        let content = await readFile(absolutePath, {encoding: 'utf-8'})

        for (const name in variables) {
            const insertionPattern = template.createInsertionPattern(name)

            content = content.replaceAll(insertionPattern, variables[name])
        }

        await writeFile(targetPath, content, {encoding: 'utf-8'})

        if (sameDirectory) await unlink(absolutePath)
    }
    for await (const file of readdir(directory, {recursive: true}))
        if (!processedFiles.has(file)) await unlink(file)

    await template.onInstalled(directory, variables)
}
