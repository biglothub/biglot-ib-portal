type PendingDelete = {
	id: string
	label: string
	executeDelete: () => Promise<void>
	timer: ReturnType<typeof setTimeout>
}

const queue = $state<{ items: PendingDelete[] }>({ items: [] })

export function getPendingDeletes(): PendingDelete[] {
	return queue.items
}

export function addPendingDelete(label: string, executeDelete: () => Promise<void>): string {
	const id = crypto.randomUUID()

	const timer = setTimeout(async () => {
		await executeDelete()
		queue.items = queue.items.filter((d) => d.id !== id)
	}, 5000)

	queue.items = [...queue.items, { id, label, executeDelete, timer }]
	return id
}

export function cancelDelete(id: string): void {
	const entry = queue.items.find((d) => d.id === id)
	if (entry) {
		clearTimeout(entry.timer)
		queue.items = queue.items.filter((d) => d.id !== id)
	}
}
