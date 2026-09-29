import {
	joinByInvite,
	parseInviteCode,
	previewInvite,
	type InvitePreview,
	type JoinResult,
	type PreviewResult
} from './invites';

const previewDebounceMs = 250;

export interface InviteLookup {
	input: string;
	readonly found: InvitePreview | null;
	readonly checking: boolean;
	readonly joining: boolean;
	readonly error: string;
	join(): Promise<JoinResult | null>;
}

export function createInviteLookup(initialValue: string): InviteLookup {
	let input = $state(initialValue);
	let preview = $state<PreviewResult | null>(null);
	let submitted = $state(false);
	let joining = $state(false);
	let joinError = $state('');

	const code = $derived(parseInviteCode(input));
	const found = $derived(preview?.ok ? preview.preview : null);
	const checking = $derived(code !== null && preview === null);

	const error = $derived.by(() => {
		if (joinError) return joinError;
		if (preview && !preview.ok) {
			return preview.reason === 'not_found'
				? 'Приглашение недействительно или истекло'
				: 'Не удалось проверить приглашение';
		}
		if (submitted && !code) return 'Вставьте ссылку-приглашение или код';
		return '';
	});

	$effect(() => {
		const current = code;
		preview = null;
		joinError = '';
		if (!current) return;
		let active = true;
		const timer = setTimeout(() => {
			void previewInvite(current).then((result) => {
				if (active) preview = result;
			});
		}, previewDebounceMs);
		return () => {
			active = false;
			clearTimeout(timer);
		};
	});

	async function join(): Promise<JoinResult | null> {
		submitted = true;
		if (!code || joining) return null;
		joining = true;
		joinError = '';
		const result = await joinByInvite(code);
		joining = false;
		if (!result.ok) joinError = result.message;
		return result;
	}

	return {
		get input() {
			return input;
		},
		set input(value: string) {
			input = value;
		},
		get found() {
			return found;
		},
		get checking() {
			return checking;
		},
		get joining() {
			return joining;
		},
		get error() {
			return error;
		},
		join
	};
}
