<script lang="ts">
	let { data } = $props();
	let { profile } = $derived(data);
</script>

<!-- Profile Tab -->
<div class="space-y-6">
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<h2 class="text-lg font-semibold mb-6">ข้อมูลโปรไฟล์</h2>

		<!-- Avatar + Name -->
		<div class="flex items-center gap-5 mb-8">
			{#if profile?.avatar_url}
				<img
					src={profile.avatar_url}
					alt={profile.full_name}
					class="w-20 h-20 rounded-full object-cover ring-2 ring-dark-border"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<div class="w-20 h-20 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary text-2xl font-bold ring-2 ring-dark-border">
					{profile?.full_name?.charAt(0) || '?'}
				</div>
			{/if}
			<div>
				<p class="text-lg font-semibold text-white">{profile?.full_name || '-'}</p>
				<p class="text-sm text-gray-500">{profile?.email || '-'}</p>
				<span class="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-brand-primary/10 text-brand-primary font-medium">
					{profile?.role === 'admin' ? 'Admin' : profile?.role === 'master_ib' ? 'Master IB' : 'Client'}
				</span>
			</div>
		</div>

		<!-- Profile fields -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
			<div>
				<label class="label" for="settings-name">ชื่อที่แสดง</label>
				<input
					id="settings-name"
					type="text"
					value={profile?.full_name || ''}
					disabled
					class="input opacity-60 cursor-not-allowed"
				/>
			</div>
			<div>
				<label class="label" for="settings-email">อีเมล</label>
				<input
					id="settings-email"
					type="email"
					value={profile?.email || ''}
					disabled
					class="input opacity-60 cursor-not-allowed"
				/>
			</div>
			<div>
				<label class="label" for="settings-role">บทบาท</label>
				<input
					id="settings-role"
					type="text"
					value={profile?.role === 'admin' ? 'Admin' : profile?.role === 'master_ib' ? 'Master IB' : 'Client'}
					disabled
					class="input opacity-60 cursor-not-allowed"
				/>
			</div>
		</div>

		<p class="text-xs text-gray-600 mt-4">
			ข้อมูลโปรไฟล์จะซิงค์จากบัญชี Google ของคุณ หากต้องการเปลี่ยนแปลง กรุณาอัปเดตที่บัญชี Google
		</p>
	</div>

	<!-- Account Info -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<h2 class="text-lg font-semibold mb-4">ข้อมูลบัญชี</h2>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div class="rounded-lg bg-dark-bg p-4">
				<p class="text-xs text-gray-500 mb-1">User ID</p>
				<p class="text-sm text-gray-300 font-mono truncate">{profile?.id || '-'}</p>
			</div>
			<div class="rounded-lg bg-dark-bg p-4">
				<p class="text-xs text-gray-500 mb-1">สถานะ</p>
				<div class="flex items-center gap-2">
					<span class="w-2 h-2 rounded-full bg-green-500"></span>
					<p class="text-sm text-gray-300">ใช้งานอยู่</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Notification Preferences placeholder -->
	<div class="rounded-xl border border-dark-border bg-dark-surface p-6">
		<h2 class="text-lg font-semibold mb-4">การแจ้งเตือน</h2>

		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">Push Notifications</p>
					<p class="text-xs text-gray-500">รับแจ้งเตือนผ่านเบราว์เซอร์</p>
				</div>
				<div class="w-10 h-6 rounded-full bg-brand-primary/20 border border-brand-primary/40 relative cursor-not-allowed opacity-60">
					<div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gray-500 transition-transform"></div>
				</div>
			</div>
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-white">อีเมลสรุปรายวัน</p>
					<p class="text-xs text-gray-500">รับสรุปผลเทรดทุกสิ้นวัน</p>
				</div>
				<div class="w-10 h-6 rounded-full bg-dark-bg border border-dark-border relative cursor-not-allowed opacity-60">
					<div class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-gray-500 transition-transform"></div>
				</div>
			</div>
		</div>

		<p class="text-xs text-gray-600 mt-4">การตั้งค่าการแจ้งเตือนจะเปิดใช้งานเร็ว ๆ นี้</p>
	</div>
</div>
