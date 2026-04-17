<script lang="ts">
	let { data, height = 72 }: {
		data: Array<{ time: number; value: number }>;
		height?: number;
	} = $props();

	const WIDTH = 160;

	let path = $derived.by(() => {
		if (data.length < 1) return { line: '', area: '' };
		const values = data.map((d) => d.value);
		const minV = Math.min(0, ...values);
		const maxV = Math.max(0, ...values);
		const rangeV = maxV - minV || 1;
		const pad = height * 0.08;
		const usableH = height - pad * 2;

		const points = data.length === 1
			? [
				{ x: 0, y: pad + usableH - ((0 - minV) / rangeV) * usableH },
				{ x: WIDTH, y: pad + usableH - ((data[0].value - minV) / rangeV) * usableH }
			]
			: data.map((d, i) => {
				const x = (i / (data.length - 1)) * WIDTH;
				const y = pad + usableH - ((d.value - minV) / rangeV) * usableH;
				return { x, y };
			});

		const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
		const area = `${line} L${WIDTH},${height} L0,${height} Z`;
		return { line, area };
	});

	let isPositive = $derived((data[data.length - 1]?.value ?? 0) >= 0);
	let color = $derived(isPositive ? '#22c55e' : '#ef4444');
	let fillColor = $derived(isPositive ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)');
</script>

<svg
	viewBox="0 0 {WIDTH} {height}"
	class="w-full overflow-visible"
	style="height: {height}px"
	aria-hidden="true"
>
	{#if path.area}
		<path d={path.area} fill={fillColor} />
		<path d={path.line} fill="none" stroke={color} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
	{/if}
</svg>
