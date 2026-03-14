import { writable } from 'svelte/store';
import type { MarketNewsArticle } from '$lib/types';

export const marketNewsStore = writable<MarketNewsArticle[]>([]);
