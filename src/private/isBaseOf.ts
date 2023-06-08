import { resolve } from 'node:path'

export function isBaseOf(path: string, base: string): boolean {
    return !resolve(base, path).startsWith('..')
}
