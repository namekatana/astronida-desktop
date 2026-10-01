export type SafetyToggleId =
	| 'screenCaptureProtection'
	| 'newDeviceAlert'
	| 'blurAdultMedia'
	| 'linkWarning';

export const defaultSafetyToggles: Record<SafetyToggleId, boolean> = {
	screenCaptureProtection: false,
	newDeviceAlert: true,
	blurAdultMedia: true,
	linkWarning: true
};
