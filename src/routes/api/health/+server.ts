import { json } from '@sveltejs/kit';
import { createSupabaseServiceClient } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

const startTime = Date.now();

export const GET: RequestHandler = async () => {
	const uptime = Math.floor((Date.now() - startTime) / 1000);

	let dbStatus: 'connected' | 'error' = 'error';
	let dbLatencyMs = 0;
	let lastSyncTime: string | null = null;

	try {
		const supabase = createSupabaseServiceClient();
		const dbStart = Date.now();

		// Simple connectivity check — query a lightweight table
		const { error: dbError } = await supabase
			.from('profiles')
			.select('id')
			.limit(1);

		dbLatencyMs = Date.now() - dbStart;

		if (!dbError) {
			dbStatus = 'connected';
		}

		// Get latest sync time from bridge_health
		const { data: bridgeData } = await supabase
			.from('bridge_health')
			.select('last_heartbeat')
			.order('last_heartbeat', { ascending: false })
			.limit(1)
			.single();

		if (bridgeData?.last_heartbeat) {
			lastSyncTime = bridgeData.last_heartbeat;
		}
	} catch {
		dbStatus = 'error';
	}

	const healthy = dbStatus === 'connected';

	return json(
		{
			status: healthy ? 'healthy' : 'unhealthy',
			uptime_seconds: uptime,
			database: {
				status: dbStatus,
				latency_ms: dbLatencyMs
			},
			last_sync: lastSyncTime,
			timestamp: new Date().toISOString()
		},
		{ status: healthy ? 200 : 503 }
	);
};
