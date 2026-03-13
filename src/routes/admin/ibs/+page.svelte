<script lang="ts">
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let { ibs } = $derived(data);

	let showAddModal = $state(false);
	let form = $state({ email: '', full_name: '', ib_code: '', company_name: '' });
	let loading = $state(false);
	let error = $state('');
	let successMsg = $state('');

	async function handleAdd(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';
		successMsg = '';

		const res = await fetch('/api/admin/ibs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});

		const result = await res.json();

		if (!res.ok) {
			error = result.message || 'เกิดข้อผิดพลาด';
		} else {
			successMsg = `สร้างสำเร็จ! Password ชั่วคราว: ${result.tempPassword}`;
			form = { email: '', full_name: '', ib_code: '', company_name: '' };
			await invalidateAll();
		}
		loading = false;
	}
</script>

<svelte:head>
	<title>Master IBs - IB Portal</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-xl font-bold">Master IBs</h1>
		<button class="btn-primary text-sm" onclick={() => { showAddModal = true; error = ''; successMsg = ''; }}>
			เพิ่ม Master IB
		</button>
	</div>

	{#if ibs.length === 0}
		<EmptyState message="ยังไม่มี Master IB" icon="👥" />
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each ibs as ib}
				<a href="/admin/ibs/{ib.id}" class="card hover:border-brand-500/30 transition-colors">
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full bg-brand-600/20 flex items-center justify-center text-brand-400 font-medium">
							{ib.profiles?.full_name?.charAt(0) || '?'}
						</div>
						<div>
							<p class="text-sm font-medium text-white">{ib.profiles?.full_name}</p>
							<p class="text-xs text-gray-500">{ib.ib_code}</p>
						</div>
					</div>
					<div class="grid grid-cols-3 gap-2 text-center">
						<div>
							<p class="text-lg font-bold text-green-400">{ib.approvedCount}</p>
							<p class="text-[10px] text-gray-500">ลูกค้า</p>
						</div>
						<div>
							<p class="text-lg font-bold text-yellow-400">{ib.pendingCount}</p>
							<p class="text-[10px] text-gray-500">รออนุมัติ</p>
						</div>
						<div>
							<p class="text-lg font-bold text-gray-400">{ib.totalCount}</p>
							<p class="text-[10px] text-gray-500">ทั้งหมด</p>
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

<!-- Add IB Modal -->
{#if showAddModal}
	<div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
		<div class="card max-w-md w-full">
			<h3 class="text-lg font-medium mb-4">เพิ่ม Master IB</h3>

			{#if error}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
			{/if}
			{#if successMsg}
				<div class="bg-green-500/10 border border-green-500/20 text-green-400 text-sm px-4 py-3 rounded-lg mb-4">
					{successMsg}
				</div>
			{/if}

			<form onsubmit={handleAdd} class="space-y-3">
				<div>
					<label for="name" class="label">ชื่อ-นามสกุล</label>
					<input id="name" type="text" bind:value={form.full_name} class="input" required />
				</div>
				<div>
					<label for="email" class="label">อีเมล</label>
					<input id="email" type="email" bind:value={form.email} class="input" required />
				</div>
				<div>
					<label for="code" class="label">รหัส IB</label>
					<input id="code" type="text" bind:value={form.ib_code} class="input" placeholder="เช่น IB001" required />
				</div>
				<div>
					<label for="company" class="label">ชื่อบริษัท (ไม่บังคับ)</label>
					<input id="company" type="text" bind:value={form.company_name} class="input" />
				</div>

				<div class="flex gap-2 justify-end pt-2">
					<button type="button" class="btn-secondary text-sm" onclick={() => showAddModal = false}>ปิด</button>
					<button type="submit" class="btn-primary text-sm" disabled={loading}>
						{loading ? 'กำลังสร้าง...' : 'สร้าง'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
