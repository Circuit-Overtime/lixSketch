// Stacks for undo/redo
const undoStack = [];
const redoStack = [];

// Call this after creating a new shape (e.g., Rectangle)
export function pushCreateAction(shape) {
    undoStack.push({
        type: 'create',
        shape: shape
    });
}

export function pushDeleteAction(shape) {
    undoStack.push({
        type: 'delete',
        shape: shape
    });
}

export function pushTransformAction(shape, oldPos, newPos) {
    if (shape.type === 'image') {
        // Handle image transforms
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                x: oldPos.x,
                y: oldPos.y,
                width: oldPos.width,
                height: oldPos.height,
                rotation: oldPos.rotation
            },
            newPos: {
                x: newPos.x,
                y: newPos.y,
                width: newPos.width,
                height: newPos.height,
                rotation: newPos.rotation
            }
        });
    } else if (shape.shapeName === 'circle') {
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                x: oldPos.x,
                y: oldPos.y,
                rx: oldPos.rx,
                ry: oldPos.ry,
                rotation: oldPos.rotation
            },
            newPos: {
                x: newPos.x,
                y: newPos.y,
                rx: newPos.rx,
                ry: newPos.ry,
                rotation: newPos.rotation
            }
        });
    } else if (shape.shapeName === 'line') {
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                startPoint: { x: oldPos.startPoint.x, y: oldPos.startPoint.y },
                endPoint: { x: oldPos.endPoint.x, y: oldPos.endPoint.y }
            },
            newPos: {
                startPoint: { x: newPos.startPoint.x, y: newPos.startPoint.y },
                endPoint: { x: newPos.endPoint.x, y: newPos.endPoint.y }
            }
        });
    } else if(shape.shapeName === "rectangle") {
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: { 
                x: oldPos.x, 
                y: oldPos.y, 
                width: oldPos.width, 
                height: oldPos.height, 
                rotation: oldPos.rotation
            },
            newPos: { 
                x: newPos.x, 
                y: newPos.y, 
                width: newPos.width, 
                height: newPos.height, 
                rotation: newPos.rotation
            }
        });
    }
    console.log(undoStack);
}

export function pushOptionsChangeAction(shape, oldOptions) {
    undoStack.push({
        type: 'optionsChange',
        shape: shape,
        oldOptions: oldOptions
    });
}

export function undo() {
    if (undoStack.length === 0) return;
    const action = undoStack.pop();
    
    if (action.type === 'create') {
        if (action.shape.type === 'image') {
            // Handle image creation undo
            action.shape.remove();
        } else {
            // Handle other shape creation undo
            const idx = shapes.indexOf(action.shape);
            if (idx !== -1) shapes.splice(idx, 1);
            if (action.shape.group.parentNode) {
                action.shape.group.parentNode.removeChild(action.shape.group);
            }
        }
        redoStack.push(action);
    } else if (action.type === 'delete') {
        if (action.shape.type === 'image') {
            // Handle image deletion undo
            action.shape.restore();
        } else {
            // Handle other shape deletion undo
            shapes.push(action.shape);
            svg.appendChild(action.shape.group);
        }
        redoStack.push(action);
    }
    else if (action.type === 'transform') {
        if (action.shape.type === 'image') {
            // Handle image transform undo
            action.shape.restore(action.oldPos);
        } else if (action.shape.shapeName === 'circle') {
            // Handle circle transform undo
            action.shape.x = action.oldPos.x;
            action.shape.y = action.oldPos.y;
            action.shape.rx = action.oldPos.rx;
            action.shape.ry = action.oldPos.ry;
            action.shape.rotation = action.oldPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if (action.shape.shapeName === 'line') {
            // Handle line transform undo
            action.shape.startPoint = { x: action.oldPos.startPoint.x, y: action.oldPos.startPoint.y };
            action.shape.endPoint = { x: action.oldPos.endPoint.x, y: action.oldPos.endPoint.y };
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if(action.shape.shapeName === "rectangle") {
            // Handle other shape transform undo
            action.shape.x = action.oldPos.x;
            action.shape.y = action.oldPos.y;
            action.shape.height = action.oldPos.height;
            action.shape.width = action.oldPos.width;
            action.shape.rotation = action.oldPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        }
        redoStack.push(action);
    }
    else if (action.type === 'optionsChange') {
        action.shape.options = action.oldOptions;
        action.shape.draw();
        redoStack.push(action);
    }
}

export function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    
    if (action.type === 'create') {
        if (action.shape.type === 'image') {
            // Handle image creation redo
            action.shape.restore();
        } else {
            // Handle other shape creation redo
            shapes.push(action.shape);
            svg.appendChild(action.shape.group);
        }
        undoStack.push(action);
    } else if (action.type === 'delete') {
        if (action.shape.type === 'image') {
            // Handle image deletion redo
            action.shape.remove();
        } else {
            // Handle other shape deletion redo
            const idx = shapes.indexOf(action.shape);
            if (idx !== -1) shapes.splice(idx, 1);
            if (action.shape.group.parentNode) {
                action.shape.group.parentNode.removeChild(action.shape.group);
            }
        }
        undoStack.push(action);
    }
    else if (action.type === 'transform') {
        if (action.shape.type === 'image') {
            // Handle image transform redo
            action.shape.restore(action.newPos);
        } else if (action.shape.shapeName === 'circle') {
            // Handle circle transform redo
            action.shape.x = action.newPos.x;
            action.shape.y = action.newPos.y;
            action.shape.rx = action.newPos.rx;
            action.shape.ry = action.newPos.ry;
            action.shape.rotation = action.newPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if (action.shape.shapeName === 'line') {
            // Handle line transform redo
            action.shape.startPoint = { x: action.newPos.startPoint.x, y: action.newPos.startPoint.y };
            action.shape.endPoint = { x: action.newPos.endPoint.x, y: action.newPos.endPoint.y };
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if(action.shape.shapeName === "rectangle") {
            // Handle other shape transform redo
            action.shape.x = action.newPos.x;
            action.shape.y = action.newPos.y;
            action.shape.height = action.newPos.height;
            action.shape.width = action.newPos.width;
            action.shape.rotation = action.newPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        }
        undoStack.push(action);
    }
}

// Optional: Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
       
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
       
    }
});

// Attach to buttons
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);