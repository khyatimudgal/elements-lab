type Success<T> = { data: T; error: null };
type Failure = { data: null; error: Error };
export type Result<T> = Success<T> | Failure;

export function tryCatchSync<T>(operation: () => T): Result<T> {
    try {
        return { data: operation(), error: null };
    } catch (caught) {
        return { data: null, error: caught instanceof Error ? caught : new Error(String(caught)) };
    }
}

export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
    try {
        return { data: await promise, error: null };
    } catch (caught) {
        return { data: null, error: caught instanceof Error ? caught : new Error(String(caught)) };
    }
}
