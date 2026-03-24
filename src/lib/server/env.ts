import { env } from '$env/dynamic/private';

interface EnvVar {
	name: string;
	required: boolean;
	description: string;
}

const ENV_VARS: EnvVar[] = [
	// Core — app cannot function without these
	{ name: 'OPENAI_API_KEY', required: true, description: 'OpenAI API key for AI features' },

	// Optional — features degrade gracefully without these
	{ name: 'MT5_ENCRYPTION_KEY', required: false, description: 'Encryption key for MT5 passwords' },
	{ name: 'RESEND_API_KEY', required: false, description: 'Resend API key for email reports' },
	{ name: 'RESEND_FROM_EMAIL', required: false, description: 'Sender email address for reports' },
	{ name: 'SENTRY_DSN', required: false, description: 'Sentry DSN for error tracking' },
	{ name: 'SENTRY_ENVIRONMENT', required: false, description: 'Sentry environment name' },
	{ name: 'VAPID_PUBLIC_KEY', required: false, description: 'VAPID public key for push notifications' },
	{ name: 'VAPID_PRIVATE_KEY', required: false, description: 'VAPID private key for push notifications' },
	{ name: 'VAPID_SUBJECT', required: false, description: 'VAPID subject for push notifications' },
	{ name: 'PUBLIC_APP_URL', required: false, description: 'Public app URL used in email links' },
	{ name: 'UPSTASH_REDIS_REST_URL', required: false, description: 'Upstash Redis REST URL for distributed rate limiting' },
	{ name: 'UPSTASH_REDIS_REST_TOKEN', required: false, description: 'Upstash Redis REST token for distributed rate limiting' },
	{ name: 'CRON_SECRET', required: false, description: 'Secret token for authenticating cron job requests' }
];

/**
 * Validates all required environment variables exist on server startup.
 * Logs warnings for missing optional variables.
 * Throws an error if any required variable is missing.
 */
export function validateEnv(): void {
	const missing: string[] = [];
	const warnings: string[] = [];

	for (const v of ENV_VARS) {
		const value = env[v.name];
		if (!value || value.trim() === '') {
			if (v.required) {
				missing.push(`  - ${v.name}: ${v.description}`);
			} else {
				warnings.push(`  - ${v.name}: ${v.description}`);
			}
		}
	}

	if (warnings.length > 0) {
		console.warn(
			`[env] Missing optional environment variables (features may be limited):\n${warnings.join('\n')}`
		);
	}

	if (missing.length > 0) {
		throw new Error(
			`[env] Missing required environment variables — server cannot start:\n${missing.join('\n')}\n\nSee .env.example for reference.`
		);
	}

	console.log('[env] Environment validation passed');
}
