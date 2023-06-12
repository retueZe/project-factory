import { minimatch, MinimatchOptions } from 'minimatch'
import { isAbsolute, relative } from 'node:path'

type Pattern = {
    content: string
    negated: boolean
    absolute: boolean
}

export class IgnorePatternList {
    private static readonly _NEGOTIATION = '!'
    private static readonly _MINIMATCH_OPTIONS: Readonly<MinimatchOptions> = {
        dot: true,
        nonegate: true
    }
    private static readonly _DEFAULT_PATTERNS: readonly Readonly<Pattern>[] = [
        {
            content: 'template.js',
            negated: false,
            absolute: false
        },
        {
            content: 'template.[cm]js',
            negated: false,
            absolute: false
        },
        {
            content: 'template.deps.json',
            negated: false,
            absolute: false
        }
    ]
    private readonly _patterns: readonly Readonly<Pattern>[]
    private readonly _hasNegations: boolean

    constructor(patterns?: Iterable<string> | null) {
        const adaptedPatterns = [...IgnorePatternList._DEFAULT_PATTERNS]
        this._patterns = adaptedPatterns

        if (typeof patterns !== 'undefined' && patterns !== null)
            for (const pattern of patterns) {
                const negated = pattern.startsWith(IgnorePatternList._NEGOTIATION)
                const content = negated
                    ? pattern.slice(IgnorePatternList._NEGOTIATION.length)
                    : pattern
                const absolute = isAbsolute(content)
                adaptedPatterns.push({content, negated, absolute})
            }

        this._hasNegations = this._patterns.some(pattern => pattern.negated)
    }

    test(path: string, directory: string): boolean {
        let ignore = false
        const relativePath = relative(directory, path)

        for (const pattern of this._patterns) {
            const toTest = pattern.absolute ? path : relativePath
            const minimatchResult = minimatch(toTest, pattern.content, IgnorePatternList._MINIMATCH_OPTIONS)

            if (!minimatchResult) continue

            ignore = !pattern.negated

            if (!this._hasNegations) break
        }

        return ignore
    }
}
