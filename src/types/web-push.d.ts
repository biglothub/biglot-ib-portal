declare module 'web-push' {
	export interface PushSubscription {
		endpoint: string;
		keys: {
			p256dh: string;
			auth: string;
		};
		expirationTime?: number | null;
	}

	export interface WebPush {
		setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
		sendNotification(subscription: PushSubscription, payload?: string): Promise<unknown>;
	}

	const webpush: WebPush;

	export default webpush;
}
