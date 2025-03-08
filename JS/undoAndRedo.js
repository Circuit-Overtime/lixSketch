

function undo() {
    if (history.length > 0) {
        const action = history.pop();
  
        switch (action.type) {
            case ACTION_CREATE:
                // Delete the created element
                action.parent.removeChild(action.element);
                break;
            case ACTION_DELETE:
                // Restore the deleted element
                if (action.nextSibling) {
                    action.parent.insertBefore(action.element, action.nextSibling);
                } else {
                    action.parent.appendChild(action.element);
                }
                break;
            case ACTION_MODIFY:
                // Revert the transformation
                if (action.data.property === "transform") {
                    const {
                        initialTransforms
                    } = action.data;
                    action.elements.forEach(el => {
                        el.setAttribute("transform", initialTransforms[el] || "translate(0,0)");
                        el.setAttribute("data-transform", initialTransforms[el] || "translate(0,0)");
                    });
                }
                break;
            default:
                console.warn("Unknown action type:", action.type);
                return; // Don't push to redoStack if action is unknown
        }
  
        redoStack.push(action);
        updateUndoRedoButtons();
        deselectAll();
    }
  }
  
  function redo() {
    if (redoStack.length > 0) {
        const action = redoStack.pop();
  
        switch (action.type) {
            case ACTION_CREATE:
                // Re-create the element
                if (action.nextSibling) {
                    action.parent.insertBefore(action.element, action.nextSibling);
                } else {
                    action.parent.appendChild(action.element);
                }
                break;
            case ACTION_DELETE:
                // Re-delete the element
                action.parent.removeChild(action.element);
                break;
            case ACTION_MODIFY:
                // Reapply the transformation
                if (action.data.property === "transform") {
                    const {
                        finalTransforms
                    } = action.data;
                    action.elements.forEach(el => {
                        el.setAttribute("transform", finalTransforms[el] || "translate(0,0)");
                        el.setAttribute("data-transform", finalTransforms[el] || "translate(0,0)");
                    });
                }
                break;
            default:
                console.warn("Unknown action type:", action.type);
                return; // Don't push to history if action is unknown
        }
  
        history.push(action);
        updateUndoRedoButtons();
        deselectAll();
    }
  }
  
  
  function updateUndoRedoButtons() {
    undoButton.classList.toggle("disabled", history.length === 0);
    redoButton.classList.toggle("disabled", redoStack.length === 0);
  }
  