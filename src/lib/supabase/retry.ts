const freshTokenCode = 'PGRST303';
const retryDelayMs = 1000;
const maxAttempts = 3;

interface QueryResult {
	error: { code?: string } | null;
}

export async function retryOnFreshToken<T extends QueryResult>(run: () => PromiseLike<T>): Promise<T> {
	let result = await run();
	for (let attempt = 1; attempt < maxAttempts && result.error?.code === freshTokenCode; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
		result = await run();
	}
	return result;
}
