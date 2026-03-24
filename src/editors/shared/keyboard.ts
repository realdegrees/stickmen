/**
 * Creates a keydown handler for undo/redo shortcuts.
 * Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo.
 * Ignores events when an input/textarea is focused.
 */
export function createUndoRedoHandler(
	doUndo: () => void,
	doRedo: () => void
): (e: KeyboardEvent) => void {
	return (e: KeyboardEvent) => {
		if (document.activeElement instanceof HTMLInputElement) return;
		if (document.activeElement instanceof HTMLTextAreaElement) return;
		const mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
		if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); doRedo(); }
	};
}
