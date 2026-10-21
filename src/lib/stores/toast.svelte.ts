export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
	id: number;
	message: string;
	kind: ToastKind;
}

class Toasts {
	items = $state<ToastItem[]>([]);
	#next = 1;

	show(message: string, kind: ToastKind = 'info', ms = 4000) {
		const id = this.#next++;
		this.items.push({ id, message, kind });
		setTimeout(() => this.dismiss(id), ms);
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new Toasts();
