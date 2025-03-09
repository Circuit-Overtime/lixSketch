function undo() {
    if (history.length > 0) {
        const action = history.pop();
        redoStack.push(action);

        if (action.type === ACTION_DELETE) {
            // Restore the deleted element
            if (action.parent) {
                // Check if the nextSibling is still in the DOM and is a child of the parent
                if (action.nextSibling && action.parent.contains(action.nextSibling)) {
                    action.parent.insertBefore(action.element, action.nextSibling);
                } else {
                    action.parent.appendChild(action.element);
                }

                // Restore the original opacity (if recorded)
                if (action.originalOpacity !== undefined) {
                    action.element.style.opacity = action.originalOpacity;
                }
            }
        } else if (action.type === ACTION_CREATE) {
            // Delete the created element
            if (action.element && action.element.parentNode) {
                action.parent.removeChild(action.element);
            }
        } else if (action.type === ACTION_MODIFY) {
            // Revert the transformation
            if (action.data.property === "transform") {
                const { initialTransforms } = action.data;
                action.elements.forEach(el => {
                    el.setAttribute("transform", initialTransforms[el] || "translate(0,0)");
                    el.setAttribute("data-transform", initialTransforms[el] || "translate(0,0)");
                });
            }
        } else if (action.type === ACTION_PASTE) {
            // Remove pasted elements
            action.elements.forEach(el => {
                if (el && el.parentNode) {  //Check if parent exists before removing
                    action.parent.removeChild(el);
                }
            });
        }

        updateUndoRedoButtons();
        deselectAll();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const action = redoStack.pop();
        history.push(action);

        if (action.type === ACTION_DELETE) {
            // Re-delete the element
            if (action.element && action.element.parentNode) {
                action.parent.removeChild(action.element);
            }
        } else if (action.type === ACTION_CREATE) {
            // Re-create the element
            if (action.nextSibling) {
                action.parent.insertBefore(action.element, action.nextSibling);
            } else {
                action.parent.appendChild(action.element);
            }
        } else if (action.type === ACTION_MODIFY) {
            // Reapply the transformation
            if (action.data.property === "transform") {
                const { finalTransforms } = action.data;
                action.elements.forEach(el => {
                    el.setAttribute("transform", finalTransforms[el] || "translate(0,0)");
                    el.setAttribute("data-transform", finalTransforms[el] || "translate(0,0)");
                });
            }
        } else if (action.type === ACTION_PASTE) {
            // Re-add pasted elements
            action.elements.forEach(el => {
                action.parent.appendChild(el);
            });
        }

        updateUndoRedoButtons();
        deselectAll();
    }
}

function updateUndoRedoButtons() {
    undoButton.classList.toggle("disabled", history.length === 0);
    redoButton.classList.toggle("disabled", redoStack.length === 0);
}