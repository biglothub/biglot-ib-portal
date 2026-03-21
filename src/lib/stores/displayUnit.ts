import { writable } from 'svelte/store';

export type DisplayUnit = 'usd' | 'pct' | 'pips';

/** Global display unit for P&L values: USD ($), Percentage (%), or Pips */
export const displayUnit = writable<DisplayUnit>('usd');
