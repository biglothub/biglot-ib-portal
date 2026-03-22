import type { Metric } from 'web-vitals';

interface VitalsPayload {
	id: string;
	name: string;
	value: number;
	rating: 'good' | 'needs-improvement' | 'poor';
	delta: number;
	navigationType: string;
	url: string;
	timestamp: number;
}

function buildPayload(metric: Metric): VitalsPayload {
	return {
		id: metric.id,
		name: metric.name,
		value: metric.value,
		rating: metric.rating,
		delta: metric.delta,
		navigationType: metric.navigationType ?? 'unknown',
		url: window.location.pathname,
		timestamp: Date.now()
	};
}

const queue: VitalsPayload[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_DELAY = 5000;

function flushQueue() {
	if (queue.length === 0) return;

	const batch = queue.splice(0);

	if (navigator.sendBeacon) {
		navigator.sendBeacon('/api/vitals', JSON.stringify(batch));
	} else {
		fetch('/api/vitals', {
			method: 'POST',
			body: JSON.stringify(batch),
			headers: { 'Content-Type': 'application/json' },
			keepalive: true
		}).catch(() => {
			// Silently ignore — vitals reporting is best-effort
		});
	}
}

function scheduleFlush() {
	if (flushTimeout) return;
	flushTimeout = setTimeout(() => {
		flushTimeout = null;
		flushQueue();
	}, FLUSH_DELAY);
}

function reportMetric(metric: Metric) {
	const payload = buildPayload(metric);
	queue.push(payload);
	scheduleFlush();
}

export async function initWebVitals() {
	const { onCLS, onLCP, onINP, onTTFB } = await import('web-vitals');

	onCLS(reportMetric);
	onLCP(reportMetric);
	onINP(reportMetric);
	onTTFB(reportMetric);

	// Flush remaining metrics when page is being unloaded
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			flushQueue();
		}
	});
}
