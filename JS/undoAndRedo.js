
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
    undoStack.push({
        type: 'transform',
        shape: shape,
        oldPos: { 
            x: oldPos.x, 
            y: oldPos.y, 
            height: oldPos.height, 
            width: oldPos.width, 
            rotation: oldPos.rotation // <-- FIXED HERE
        },
        newPos: { 
            x: newPos.x, 
            y: newPos.y, 
            height: newPos.height, 
            width: newPos.width, 
            rotation: newPos.rotation // <-- FIXED HERE
        }
    });
    console.log(undoStack)
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
        const idx = shapes.indexOf(action.shape);
        if (idx !== -1) shapes.splice(idx, 1);
        if (action.shape.group.parentNode) {
            action.shape.group.parentNode.removeChild(action.shape.group);
        }
        redoStack.push(action);
    } else if (action.type === 'delete') {
        shapes.push(action.shape);
        svg.appendChild(action.shape.group);
        redoStack.push(action);
    }
    else if (action.type === 'transform') {
        action.shape.x = action.oldPos.x;
        action.shape.y = action.oldPos.y;
        action.shape.height = action.oldPos.height;
        action.shape.width = action.oldPos.width;
        action.shape.rotation = action.oldPos.rotation;
        action.shape.draw();
        redoStack.push(action);
    }
    else if (action.type === 'optionsChange')
    {
        action.shape.options = action.oldOptions;
        action.shape.draw();
        redoStack.push(action);
    }
}

export function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    if (action.type === 'create') {
        shapes.push(action.shape);
        svg.appendChild(action.shape.group);
        undoStack.push(action);
    } else if (action.type === 'delete') {
        const idx = shapes.indexOf(action.shape);
        if (idx !== -1) shapes.splice(idx, 1);
        if (action.shape.group.parentNode) {
            action.shape.group.parentNode.removeChild(action.shape.group);
        }
        undoStack.push(action);
    }
    else if (action.type === 'transform') {
        action.shape.x = action.newPos.x;
        action.shape.y = action.newPos.y;
        action.shape.draw();
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