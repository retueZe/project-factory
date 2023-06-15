export function concatFunctions<F extends (...args: any[]) => void | PromiseLike<void>>(
    first: F,
    second: F
): (...args: Parameters<F>) => void | PromiseLike<void> {
    return function(...args) {
        const result = first(...args)

        return typeof result === 'undefined'
            ? second(...args)
            : result.then(() => second(...args))
    }
}
