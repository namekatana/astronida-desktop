const resets: (() => void)[] = [];

export function onAccountReset(reset: () => void) {
	resets.push(reset);
}

export function resetAccount() {
	for (const reset of resets) reset();
}
