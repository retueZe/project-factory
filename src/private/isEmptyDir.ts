import { Dir } from 'node:fs'
import { opendir } from 'node:fs/promises'

export async function isEmptyDir(directory: string): Promise<boolean> {
    let dir: Dir | null = null

    try {
        dir = await opendir(directory)
        const entry = await dir.read()

        return entry === null
    } finally {
        if (dir !== null) await dir.close()
    }
}
