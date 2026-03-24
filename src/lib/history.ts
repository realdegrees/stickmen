/**
 * Generic undo/redo history stack.
 *
 * Usage:
 *   const history = createHistory(capture, restore);
 *   history.snapshot();   // call BEFORE each state-changing action
 *   history.undo();
 *   history.redo();
 *   history.canUndo();    // boolean — use for button disabled state
 *   history.canRedo();
 */
export function createHistory<T>(
	capture: () => T,
	restore: (snapshot: T) => void,
	maxSize = 50
) {
	let undoStack: T[] = [];
	let redoStack: T[] = [];

	return {
		snapshot() {
			undoStack = [...undoStack.slice(-(maxSize - 1)), capture()];
			redoStack = [];
		},
		undo() {
			if (!undoStack.length) return;
			redoStack = [...redoStack, capture()];
			restore(undoStack[undoStack.length - 1]);
			undoStack = undoStack.slice(0, -1);
		},
		redo() {
			if (!redoStack.length) return;
			undoStack = [...undoStack, capture()];
			restore(redoStack[redoStack.length - 1]);
			redoStack = redoStack.slice(0, -1);
		},
		canUndo: () => undoStack.length > 0,
		canRedo: () => redoStack.length > 0,
	};
}
