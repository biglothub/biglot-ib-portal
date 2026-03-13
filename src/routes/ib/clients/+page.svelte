<script lang="ts">
	// Redirect to IB dashboard which shows client list
	import { redirect } from '@sveltejs/kit';
</script>

<script lang="ts" context="module">
	export function load() {
		throw redirect(303, '/ib');
	}
</script>
