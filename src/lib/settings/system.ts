export type SystemToggleId = 'launchAtLogin' | 'startMinimized' | 'closeToTray' | 'autoUpdate';

export const defaultSystemToggles: Record<SystemToggleId, boolean> = {
	launchAtLogin: false,
	startMinimized: false,
	closeToTray: true,
	autoUpdate: true
};

export const launchOptions: { id: SystemToggleId; label: string; description?: string }[] = [
	{ id: 'launchAtLogin', label: 'Открывать при входе в Windows' },
	{ id: 'startMinimized', label: 'Запускать свёрнутым', description: 'Сразу в трей, без окна' },
	{
		id: 'closeToTray',
		label: 'Сворачивать в трей при закрытии',
		description: 'Остаётесь в сети и получаете уведомления'
	}
];
