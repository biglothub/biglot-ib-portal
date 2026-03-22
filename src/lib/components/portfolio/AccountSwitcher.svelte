<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	interface AccountInfo {
		id: string;
		client_name: string;
		mt5_account_id: string;
		mt5_server: string;
		status: string;
		last_synced_at: string | null;
	}

	let {
		currentAccount,
		allAccounts,
	}: {
		currentAccount: AccountInfo;
		allAccounts: AccountInfo[];
	} = $props();

	let open = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);

	function handleClickOutside(e: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			document.addEventListener('click', handleClickOutside, true);
			return () => document.removeEventListener('click', handleClickOutside, true);
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	async function switchAccount(accountId: string) {
		open = false;
		if (accountId === currentAccount.id) return;

		// Preserve current path, replace/add account_id param
		const url = new URL($page.url);
		url.searchParams.set('account_id', accountId);
		await goto(url.pathname + url.search, { invalidateAll: true });
	}

	const showSwitcher = $derived(allAccounts.length > 1);
</script>

{#if showSwitcher}
	<div class="relative" bind:this={dropdownRef}>
		<button
			onclick={() => open = !open}
			onkeydown={handleKeydown}
			class="flex items-center gap-2 rounded-lg border border-dark-border px-3 py-1.5 text-sm transition-colors hover:border-brand-primary/40 hover:bg-dark-surface/50"
			aria-expanded={open}
			aria-haspopup="listbox"
			aria-label="เปลี่ยนบัญชี"
		>
			<div class="flex items-center gap-2">
				<div class="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
					<span class="text-xs font-bold text-brand-primary">
						{currentAccount.client_name.charAt(0).toUpperCase()}
					</span>
				</div>
				<div class="text-left">
					<div class="text-xs font-medium text-white truncate max-w-[120px]">{currentAccount.client_name}</div>
					<div class="text-[10px] text-gray-500">MT5: {currentAccount.mt5_account_id}</div>
				</div>
			</div>
			<svg
				class="w-3.5 h-3.5 text-gray-500 transition-transform {open ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if open}
			<div
				class="absolute top-full left-0 mt-1 w-64 bg-dark-surface border border-dark-border rounded-lg shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-1 duration-150"
				role="listbox"
				aria-label="เลือกบัญชี"
			>
				<div class="px-3 py-2 border-b border-dark-border">
					<span class="text-xs font-medium text-gray-500 uppercase tracking-wider">เลือกบัญชี</span>
				</div>
				{#each allAccounts as acc (acc.id)}
					<button
						onclick={() => switchAccount(acc.id)}
						role="option"
						aria-selected={acc.id === currentAccount.id}
						class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
							{acc.id === currentAccount.id
								? 'bg-brand-primary/10'
								: 'hover:bg-dark-hover'}"
					>
						<div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0
							{acc.id === currentAccount.id
								? 'bg-brand-primary/20'
								: 'bg-dark-border'}">
							<span class="text-xs font-bold {acc.id === currentAccount.id ? 'text-brand-primary' : 'text-gray-400'}">
								{acc.client_name.charAt(0).toUpperCase()}
							</span>
						</div>
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium truncate {acc.id === currentAccount.id ? 'text-brand-primary' : 'text-white'}">
								{acc.client_name}
							</div>
							<div class="text-xs text-gray-500">
								MT5: {acc.mt5_account_id} @ {acc.mt5_server}
							</div>
						</div>
						{#if acc.id === currentAccount.id}
							<svg class="w-4 h-4 text-brand-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<!-- Single account — just show info, no dropdown -->
	<div class="flex items-center gap-2 text-sm">
		<div class="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
			<span class="text-xs font-bold text-brand-primary">
				{currentAccount.client_name.charAt(0).toUpperCase()}
			</span>
		</div>
		<div>
			<div class="text-xs font-medium text-white">{currentAccount.client_name}</div>
			<div class="text-[10px] text-gray-500">MT5: {currentAccount.mt5_account_id}</div>
		</div>
	</div>
{/if}
