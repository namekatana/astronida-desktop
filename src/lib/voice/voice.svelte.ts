
export interface VoiceConnection {
	serverId: string;
	serverName: string;
	channelId: string;
	channelName: string;
}

let micMuted = $state(false);
let deafened = $state(false);
let connected = $state<VoiceConnection | null>(null);
let micMutedBeforeDeafen = false;

export const voice = {
	get micMuted() {
		return deafened || micMuted;
	},
	get deafened() {
		return deafened;
	},
	get connected() {
		return connected;
	},

	toggleMic() {
		if (deafened) {
			deafened = false;
			micMuted = false;
			return;
		}
		micMuted = !micMuted;
	},

	toggleDeafen() {
		if (deafened) {
			deafened = false;
			micMuted = micMutedBeforeDeafen;
		} else {
			micMutedBeforeDeafen = micMuted;
			deafened = true;
		}
	},

	connect(target: VoiceConnection) {
		connected = target;
	},

	disconnect() {
		connected = null;
	}
};
