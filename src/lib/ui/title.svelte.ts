let title = $state('');

export const windowTitle = {
	get value() {
		return title;
	},
	set(next: string) {
		title = next;
	}
};
