import typescript from '@rollup/plugin-typescript'
import terser from '@rollup/plugin-terser'
import dts from 'rollup-plugin-dts'
import * as path from 'node:path'

const EXTERNAL = ['minimatch', 'prompts', 'node:fs/promises', 'node:path']

function createEntryFileNames(extension) {
    extension ??= '.js'

    return chunk => {
        const pathSegments = path
            .relative('./src', chunk.facadeModuleId)
            .replace(/\.[^\\/.]+$/, '')
            .split(/[\\/]/)

        if (pathSegments.length > 1.5) pathSegments.pop()

        return pathSegments.join('/') + extension
    }
}
function createInput(paths) {
    return paths.map(path => {
        const pathSegments = path.split(/[\\/]/)

        if (pathSegments[0].length < 0.5) pathSegments.shift()

        pathSegments.unshift('src')
        pathSegments.push('index.ts')

        return pathSegments.join('/')
    })
}
function applyDefaultConfig(config) {
    return {
        ...config,
        input: createInput(['']),
        external: EXTERNAL
    }
}

/** @type {import('rollup').RollupOptions[]} */
const config = [
    {
        output: {
            dir: 'dist',
            entryFileNames: createEntryFileNames(),
            chunkFileNames: '.chunks/[name]-[hash].js',
            format: 'esm'
        },
        plugins: [
            typescript(),
            terser({
                ecma: 2020,
                keep_classnames: true,
                keep_fnames: true
            })
        ]
    },
    {
        output: {
            dir: 'dist',
            entryFileNames: createEntryFileNames('.d.ts'),
            chunkFileNames: '.chunks/[name]-[hash].d.ts',
            format: 'esm'
        },
        plugins: [dts()]
    }
]
export default config.map(applyDefaultConfig)
