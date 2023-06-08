import { resolve } from 'node:path'

export function toAbsolute(directory: string): string {
    const cwd = process.cwd()

    return resolve(cwd, directory)
}
