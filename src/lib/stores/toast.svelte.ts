type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
	id: string
	type: ToastType
	title: string
	detail?: string
	timer: ReturnType<typeof setTimeout>
	createdAt: number
}

const DURATION_MS = 4500

const queue = $state<{ items: ToastItem[] }>({ items: [] })

export function getToasts(): ToastItem[] {
	return queue.items
}

function add(type: ToastType, title: string, detail?: string): string {
	const id = crypto.randomUUID()

	const timer = setTimeout(() => {
		dismiss(id)
	}, DURATION_MS)

	queue.items = [
		...queue.items,
		{ id, type, title, detail, timer, createdAt: Date.now() }
	]

	return id
}

export function dismiss(id: string): void {
	const entry = queue.items.find((t) => t.id === id)
	if (entry) clearTimeout(entry.timer)
	queue.items = queue.items.filter((t) => t.id !== id)
}

export const toast = {
	success: (title: string, opts?: { detail?: string }) => add('success', title, opts?.detail),
	error: (title: string, opts?: { detail?: string }) => add('error', title, opts?.detail),
	info: (title: string, opts?: { detail?: string }) => add('info', title, opts?.detail)
}

/** Format a Date as HH:mm น. for "last saved" labels */
export function formatSavedTime(d: Date): string {
	return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'
}
