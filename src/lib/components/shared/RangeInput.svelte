<script lang="ts">
	let {
		label,
		min = $bindable(null),
		max = $bindable(null),
		step = 1,
		placeholderMin = 'ต่ำสุด',
		placeholderMax = 'สูงสุด',
		unit = '',
		onchange
	}: {
		label: string;
		min: number | null;
		max: number | null;
		step?: number;
		placeholderMin?: string;
		placeholderMax?: string;
		unit?: string;
		onchange?: () => void;
	} = $props();

	let hasError = $derived(min != null && max != null && min > max);

	function handleInput(field: 'min' | 'max', e: Event) {
		const target = e.target as HTMLInputElement;
		const val = target.value === '' ? null : parseFloat(target.value);
		if (field === 'min') min = val;
		else max = val;
		onchange?.();
	}
</script>

<div class="space-y-1">
	<span class="text-xs text-gray-400">{label}{unit ? ` (${unit})` : ''}</span>
	<div class="flex items-center gap-1.5">
		<input
			type="number"
			value={min ?? ''}
			oninput={(e) => handleInput('min', e)}
			placeholder={placeholderMin}
			{step}
			aria-label="{label} ต่ำสุด"
			class="w-full bg-dark-bg border rounded px-2.5 py-2 text-sm text-white placeholder-gray-600
				{hasError ? 'border-red-500/50' : 'border-dark-border'}"
		/>
		<span class="text-gray-600 text-xs shrink-0">-</span>
		<input
			type="number"
			value={max ?? ''}
			oninput={(e) => handleInput('max', e)}
			placeholder={placeholderMax}
			{step}
			aria-label="{label} สูงสุด"
			class="w-full bg-dark-bg border rounded px-2.5 py-2 text-sm text-white placeholder-gray-600
				{hasError ? 'border-red-500/50' : 'border-dark-border'}"
		/>
	</div>
</div>
