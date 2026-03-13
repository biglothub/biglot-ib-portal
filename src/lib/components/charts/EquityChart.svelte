<script lang="ts">
	import { onMount } from 'svelte';

	let {
		data,
		height = 300
	}: {
		data: { time: string | number; value: number }[];
		height?: number;
	} = $props();

	let container: HTMLDivElement;
	let cleanup: (() => void) | undefined;

	onMount(() => {
		if (!data || data.length === 0) return;

		import('lightweight-charts').then(({ createChart, ColorType }) => {
			const chart = createChart(container, {
				height,
				layout: {
					background: { type: ColorType.Solid, color: 'transparent' },
					textColor: '#9ca3af',
					fontFamily: 'Inter, sans-serif',
					fontSize: 11,
				},
				grid: {
					vertLines: { color: '#262626' },
					horzLines: { color: '#262626' },
				},
				rightPriceScale: {
					borderColor: '#262626',
				},
				timeScale: {
					borderColor: '#262626',
					timeVisible: true,
					secondsVisible: false,
				},
				crosshair: {
					horzLine: { color: '#404040', labelBackgroundColor: '#262626' },
					vertLine: { color: '#404040', labelBackgroundColor: '#262626' },
				},
			});

			const areaSeries = chart.addAreaSeries({
				topColor: 'rgba(37, 99, 235, 0.4)',
				bottomColor: 'rgba(37, 99, 235, 0.0)',
				lineColor: '#2563eb',
				lineWidth: 2,
			});

			areaSeries.setData(data as any);
			chart.timeScale().fitContent();

			const observer = new ResizeObserver(() => {
				chart.applyOptions({ width: container.clientWidth });
			});
			observer.observe(container);

			cleanup = () => {
				observer.disconnect();
				chart.remove();
			};
		});

		return () => cleanup?.();
	});
</script>

<div bind:this={container} class="w-full"></div>
