import { readdir as nodeReaddir, stat } from 'node:fs/promises'
import { join } from 'node:path'

export type ReaddirOptions = {
    /**
     * @default false
     */
    recursive?: boolean | null
}

export async function* readdir(directory: string, options?: Readonly<ReaddirOptions> | null): AsyncGenerator<string> {
    const recursive = options?.recursive ?? false

    for (const file of await nodeReaddir(directory, {recursive})) {
        const path = join(directory, file)
        const _stat = await stat(path)

        if (_stat.isFile())
            yield path
        else if (recursive)
            yield* readdir(path, {recursive})
    }
}
