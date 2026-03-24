import 'svelte/elements';

declare module 'svelte/elements' {
	interface HTMLAttributes<T> {
		/**
		 * Marks an element as a walkable surface for stickmen inside a `<StickmenStage>`.
		 *
		 * - `true` / bare attribute — top edge always walkable; bottom edge walkable if element has a visible border-bottom
		 * - `"top"` — top edge only
		 * - `"bottom"` — bottom edge only
		 * - `"false"` — explicitly excluded, overrides selector match
		 *
		 * Note: `{false}` (JS boolean) removes the attribute entirely and has no effect.
		 * Use the string `"false"` to opt an element out.
		 */
		'data-walkable'?: true | 'top' | 'bottom' | 'false';
	}
}
