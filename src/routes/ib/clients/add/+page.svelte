<script lang="ts">
	import { goto } from '$app/navigation';

	let form = $state({
		client_name: '',
		client_email: '',
		client_phone: '',
		mt5_account_id: '',
		mt5_investor_password: '',
		mt5_server: ''
	});

	let step = $state(1);
	let loading = $state(false);
	let error = $state('');
	let success = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const res = await fetch('/api/ib/clients', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});

		const result = await res.json();

		if (!res.ok) {
			error = result.message || 'เกิดข้อผิดพลาด';
			loading = false;
			return;
		}

		success = true;
		loading = false;
	}
</script>

<svelte:head>
	<title>เพิ่มลูกค้า - IB Portal</title>
</svelte:head>

<div class="max-w-lg mx-auto space-y-6">
	<a href="/ib" class="text-sm text-gray-500 hover:text-brand-400">&larr; กลับ</a>
	<h1 class="text-xl font-bold">เพิ่มลูกค้าใหม่</h1>

	{#if success}
		<div class="card text-center py-8">
			<span class="text-4xl mb-4 block">✅</span>
			<h2 class="text-lg font-medium text-white mb-2">ส่งข้อมูลสำเร็จ!</h2>
			<p class="text-sm text-gray-400 mb-4">
				ลูกค้าของคุณอยู่ในคิวรออนุมัติ<br/>
				Admin จะตรวจสอบและอนุมัติให้เร็วที่สุด
			</p>
			<div class="flex gap-2 justify-center">
				<a href="/ib" class="btn-secondary text-sm">กลับ Dashboard</a>
				<button class="btn-primary text-sm" onclick={() => {
					success = false;
					form = { client_name: '', client_email: '', client_phone: '', mt5_account_id: '', mt5_investor_password: '', mt5_server: '' };
					step = 1;
				}}>
					เพิ่มลูกค้าอีกคน
				</button>
			</div>
		</div>
	{:else}
		<!-- Step indicator -->
		<div class="flex items-center gap-2">
			{#each [1, 2] as s}
				<div class="flex items-center gap-2">
					<div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
						{step >= s ? 'bg-brand-600 text-white' : 'bg-dark-border text-gray-500'}">
						{s}
					</div>
					<span class="text-xs text-gray-500">{s === 1 ? 'ข้อมูลลูกค้า' : 'MT5 Credentials'}</span>
				</div>
				{#if s < 2}
					<div class="flex-1 h-px {step > s ? 'bg-brand-600' : 'bg-dark-border'}"></div>
				{/if}
			{/each}
		</div>

		{#if error}
			<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
		{/if}

		<form onsubmit={handleSubmit} class="card space-y-4">
			{#if step === 1}
				<div>
					<label for="name" class="label">ชื่อลูกค้า *</label>
					<input id="name" type="text" bind:value={form.client_name} class="input" required />
				</div>
				<div>
					<label for="email" class="label">อีเมล (ใช้สำหรับสร้าง login)</label>
					<input id="email" type="email" bind:value={form.client_email} class="input" placeholder="จะได้รับ login หลัง approve" />
				</div>
				<div>
					<label for="phone" class="label">เบอร์โทร</label>
					<input id="phone" type="tel" bind:value={form.client_phone} class="input" />
				</div>
				<button
					type="button"
					class="btn-primary w-full"
					disabled={!form.client_name}
					onclick={() => step = 2}
				>
					ถัดไป
				</button>
			{:else}
				<div>
					<label for="mt5id" class="label">MT5 Account ID *</label>
					<input id="mt5id" type="text" bind:value={form.mt5_account_id} class="input" placeholder="เช่น 12345678" required />
				</div>
				<div>
					<label for="mt5pass" class="label">Investor Password *</label>
					<input id="mt5pass" type="password" bind:value={form.mt5_investor_password} class="input" required />
				</div>
				<div>
					<label for="mt5server" class="label">MT5 Server *</label>
					<input id="mt5server" type="text" bind:value={form.mt5_server} class="input" placeholder="เช่น Exness-MT5Real" required />
				</div>

				<div class="flex gap-2">
					<button type="button" class="btn-secondary flex-1" onclick={() => step = 1}>ย้อนกลับ</button>
					<button type="submit" class="btn-primary flex-1" disabled={loading || !form.mt5_account_id || !form.mt5_investor_password || !form.mt5_server}>
						{loading ? 'กำลังส่ง...' : 'ส่งรออนุมัติ'}
					</button>
				</div>
			{/if}
		</form>
	{/if}
</div>
