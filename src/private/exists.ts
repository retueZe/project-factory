import { access } from 'fs/promises'

export async function exists(path: string, mode?: number | null): Promise<boolean> {
    try {
        await access(path, mode ?? undefined)

        return true
    } catch (error: any) {
        if (typeof error === 'object' && error !== null && error.code === 'ENOENT')
            return false

        throw error
    }
}
