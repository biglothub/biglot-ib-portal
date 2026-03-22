<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';

	let { data } = $props();
	let coaches = $derived(data.coaches);

	const COLOR_PRESETS = [
		{ label: 'Pink', gradient: 'from-pink-500 to-rose-400', border: 'border-pink-500/30', text: 'text-pink-400', bg: 'bg-pink-500/10', glow: '236,72,153' },
		{ label: 'Orange', gradient: 'from-orange-500 to-amber-400', border: 'border-orange-500/30', text: 'text-orange-400', bg: 'bg-orange-500/10', glow: '249,115,22' },
		{ label: 'Yellow', gradient: 'from-yellow-500 to-amber-300', border: 'border-yellow-500/30', text: 'text-yellow-400', bg: 'bg-yellow-500/10', glow: '234,179,8' },
		{ label: 'Green', gradient: 'from-green-500 to-emerald-400', border: 'border-green-500/30', text: 'text-green-400', bg: 'bg-green-500/10', glow: '34,197,94' },
		{ label: 'Teal', gradient: 'from-teal-500 to-cyan-400', border: 'border-teal-500/30', text: 'text-teal-400', bg: 'bg-teal-500/10', glow: '20,184,166' },
		{ label: 'Blue', gradient: 'from-blue-500 to-indigo-400', border: 'border-blue-500/30', text: 'text-blue-400', bg: 'bg-blue-500/10', glow: '59,130,246' },
		{ label: 'Purple', gradient: 'from-purple-500 to-violet-400', border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-500/10', glow: '168,85,247' },
		{ label: 'Fuchsia', gradient: 'from-pink-500 to-fuchsia-400', border: 'border-pink-500/30', text: 'text-pink-400', bg: 'bg-pink-500/10', glow: '217,70,239' },
		{ label: 'Red', gradient: 'from-red-500 to-rose-400', border: 'border-red-500/30', text: 'text-red-400', bg: 'bg-red-500/10', glow: '239,68,68' }
	];

	function emptyForm() {
		return {
			id: '',
			name: '',
			channel_name: '',
			youtube_handle: '',
			avatar_url: '',
			start_hour: 0,
			end_hour: 0,
			time_display: '',
			color_preset: 5,
			is_active: true,
			sort_order: coaches.length + 1
		};
	}

	let showModal = $state(false);
	let isEditing = $state(false);
	let form = $state(emptyForm());
	let loading = $state(false);
	let error = $state('');
	let deleteConfirmId = $state('');

	function openAdd() {
		form = emptyForm();
		isEditing = false;
		error = '';
		showModal = true;
	}

	function openEdit(coach: typeof coaches[0]) {
		const presetIdx = COLOR_PRESETS.findIndex(p => p.gradient === coach.color_gradient);
		form = {
			id: coach.id,
			name: coach.name,
			channel_name: coach.channel_name,
			youtube_handle: coach.youtube_handle,
			avatar_url: coach.avatar_url || '',
			start_hour: coach.start_hour,
			end_hour: coach.end_hour,
			time_display: coach.time_display,
			color_preset: presetIdx >= 0 ? presetIdx : 5,
			is_active: coach.is_active,
			sort_order: coach.sort_order
		};
		isEditing = true;
		error = '';
		showModal = true;
	}

	function updateTimeDisplay() {
		const sh = String(form.start_hour).padStart(2, '0');
		const eh = form.end_hour > 23 ? String(form.end_hour - 24).padStart(2, '0') : String(form.end_hour).padStart(2, '0');
		form.time_display = `${sh}:00-${eh}:00`;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const preset = COLOR_PRESETS[form.color_preset] || COLOR_PRESETS[5];
		const payload = {
			...(isEditing ? { id: form.id } : {}),
			name: form.name,
			channel_name: form.channel_name,
			youtube_handle: form.youtube_handle,
			avatar_url: form.avatar_url || null,
			start_hour: form.start_hour,
			end_hour: form.end_hour,
			time_display: form.time_display,
			color_gradient: preset.gradient,
			color_border: preset.border,
			color_text: preset.text,
			color_bg: preset.bg,
			glow_rgb: preset.glow,
			is_active: form.is_active,
			sort_order: form.sort_order
		};

		const res = await fetch('/api/admin/coaches', {
			method: isEditing ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});

		const result = await res.json();
		if (!res.ok) {
			error = result.message || 'เกิดข้อผิดพลาด';
		} else {
			showModal = false;
			await invalidateAll();
		}
		loading = false;
	}

	async function handleDelete(id: string) {
		loading = true;
		const res = await fetch('/api/admin/coaches', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});

		if (res.ok) {
			deleteConfirmId = '';
			await invalidateAll();
		} else {
			const result = await res.json();
			error = result.message || 'ลบไม่สำเร็จ';
		}
		loading = false;
	}

	async function toggleActive(coach: typeof coaches[0]) {
		await fetch('/api/admin/coaches', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: coach.id, is_active: !coach.is_active })
		});
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>จัดการโค้ช - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-xl font-bold">จัดการตารางโค้ช</h1>
			<p class="text-xs text-gray-500 mt-1">เพิ่ม แก้ไข ลบ โค้ช Live Trade</p>
		</div>
		<button class="btn-primary text-sm" onclick={openAdd}>
			เพิ่มโค้ช
		</button>
	</div>

	{#if coaches.length === 0}
		<EmptyState message="ยังไม่มีโค้ชในระบบ" icon="🎓" />
	{:else}
		<div class="space-y-2">
			{#each coaches as coach (coach.id)}
				<div class="card flex items-center gap-4 {!coach.is_active ? 'opacity-50' : ''}">
					<!-- Sort order -->
					<div class="flex-shrink-0 w-8 text-center">
						<span class="text-xs text-gray-500 font-mono">{coach.sort_order}</span>
					</div>

					<!-- Color badge -->
					<div class="flex-shrink-0 w-28">
						<div class="rounded-lg bg-gradient-to-r {coach.color_gradient} px-2.5 py-1.5 text-center">
							<div class="text-[10px] font-bold text-white truncate">{coach.name}</div>
							<div class="text-[9px] text-white/80">{coach.time_display}</div>
						</div>
					</div>

					<!-- Avatar -->
					<div class="flex-shrink-0">
						{#if coach.avatar_url}
							<img src={coach.avatar_url} alt={coach.name} class="w-9 h-9 rounded-full object-cover border border-dark-border" />
						{:else}
							<div class="w-9 h-9 rounded-full bg-dark-hover border border-dark-border flex items-center justify-center">
								<span class="text-xs text-gray-500">{coach.name.charAt(6) || '?'}</span>
							</div>
						{/if}
					</div>

					<!-- Info -->
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-white truncate">{coach.channel_name}</p>
						<p class="text-xs text-gray-500 truncate">{coach.youtube_handle}</p>
					</div>

					<!-- Status -->
					<div class="flex-shrink-0">
						<button
							onclick={() => toggleActive(coach)}
							class="text-[10px] px-2 py-0.5 rounded-full border transition-colors
								{coach.is_active
									? 'bg-green-500/10 border-green-500/20 text-green-400'
									: 'bg-gray-500/10 border-gray-500/20 text-gray-500'}"
						>
							{coach.is_active ? 'เปิด' : 'ปิด'}
						</button>
					</div>

					<!-- Actions -->
					<div class="flex-shrink-0 flex items-center gap-1">
						<button
							onclick={() => openEdit(coach)}
							class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-dark-hover transition-colors"
							title="แก้ไข"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
						</button>
						{#if deleteConfirmId === coach.id}
							<button
								onclick={() => handleDelete(coach.id)}
								class="px-2 py-1 rounded-lg text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
								disabled={loading}
							>
								ยืนยันลบ
							</button>
							<button
								onclick={() => deleteConfirmId = ''}
								class="px-2 py-1 rounded-lg text-[10px] text-gray-400 hover:text-white transition-colors"
							>
								ยกเลิก
							</button>
						{:else}
							<button
								onclick={() => deleteConfirmId = coach.id}
								class="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-dark-hover transition-colors"
								title="ลบ"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Add/Edit Modal -->
{#if showModal}
	<div transition:fade={{ duration: 200 }} class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div transition:fly={{ y: 30, duration: 250 }} class="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
			<h3 class="text-lg font-medium mb-4">{isEditing ? 'แก้ไขโค้ช' : 'เพิ่มโค้ชใหม่'}</h3>

			{#if error}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="coach-name" class="label">ชื่อโค้ช</label>
						<input id="coach-name" type="text" bind:value={form.name} class="input" placeholder="COACH PING" required />
					</div>
					<div>
						<label for="channel" class="label">ชื่อช่อง</label>
						<input id="channel" type="text" bind:value={form.channel_name} class="input" placeholder="Gold with Ping" required />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="youtube" class="label">YouTube Handle</label>
						<input id="youtube" type="text" bind:value={form.youtube_handle} class="input" placeholder="@goldwithping" required />
					</div>
					<div>
						<label for="avatar" class="label">Avatar URL (ไม่บังคับ)</label>
						<input id="avatar" type="text" bind:value={form.avatar_url} class="input" placeholder="/coaches/ping.png" />
					</div>
				</div>

				<div class="grid grid-cols-3 gap-3">
					<div>
						<label for="start" class="label">เริ่ม (ชม.)</label>
						<input id="start" type="number" bind:value={form.start_hour} class="input" min="0" max="23" oninput={updateTimeDisplay} required />
					</div>
					<div>
						<label for="end" class="label">จบ (ชม.)</label>
						<input id="end" type="number" bind:value={form.end_hour} class="input" min="1" max="26" oninput={updateTimeDisplay} required />
						<p class="text-[10px] text-gray-600 mt-0.5">ข้ามวัน: ใช้ 25=01:00, 26=02:00</p>
					</div>
					<div>
						<label for="display" class="label">แสดงเวลา</label>
						<input id="display" type="text" bind:value={form.time_display} class="input" placeholder="05:00-07:00" required />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="sort" class="label">ลำดับ</label>
						<input id="sort" type="number" bind:value={form.sort_order} class="input" min="0" />
					</div>
					<div class="flex items-end pb-1">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="checkbox" bind:checked={form.is_active} class="w-4 h-4 rounded border-dark-border bg-dark-surface text-brand-primary focus:ring-brand-primary" />
							<span class="text-sm text-gray-300">เปิดใช้งาน</span>
						</label>
					</div>
				</div>

				<!-- Color preset -->
				<div>
					<label class="label">สีธีม</label>
					<div class="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
						{#each COLOR_PRESETS as preset, i}
							<button
								type="button"
								onclick={() => form.color_preset = i}
								class="rounded-lg p-2 text-center text-[10px] font-medium border-2 transition-all
									{form.color_preset === i ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'}"
							>
								<div class="h-4 rounded bg-gradient-to-r {preset.gradient} mb-1"></div>
								<span class="text-gray-400">{preset.label}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Preview -->
				<div>
					<label class="label">ตัวอย่าง</label>
					<div class="mt-1 rounded-xl bg-gradient-to-r {COLOR_PRESETS[form.color_preset]?.gradient ?? COLOR_PRESETS[5].gradient} px-4 py-2.5 text-center">
						<div class="text-xs font-bold text-white tracking-wider">{form.name || 'COACH NAME'}</div>
						<div class="text-xs text-white/80">{form.time_display || '00:00-00:00'}</div>
					</div>
				</div>

				<div class="flex gap-2 justify-end pt-2">
					<button type="button" class="btn-secondary text-sm" onclick={() => showModal = false}>ปิด</button>
					<button type="submit" class="btn-primary text-sm" disabled={loading}>
						{loading ? 'กำลังบันทึก...' : isEditing ? 'บันทึก' : 'เพิ่ม'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
