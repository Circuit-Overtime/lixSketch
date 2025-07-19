// Stacks for undo/redo
const undoStack = [];
const redoStack = [];

// Import references to text-related variables and functions
let selectedElement = null;
let updateSelectionFeedback = null;
let svg = null;

// Function to set references from other modules
export function setTextReferences(element, updateFn, svgElement) {
    selectedElement = element;
    updateSelectionFeedback = updateFn;
    svg = svgElement;
}

// Function to get current selectedElement (called from other modules)
export function getCurrentSelectedElement() {
    return selectedElement;
}

// Function to update selectedElement reference (called from other modules)
export function updateSelectedElement(element) {
    selectedElement = element;
}

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
    if (shape.type === 'text') {
        // Handle text transforms
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                x: oldPos.x,
                y: oldPos.y,
                rotation: oldPos.rotation,
                fontSize: oldPos.fontSize
            },
            newPos: {
                x: newPos.x,
                y: newPos.y,
                rotation: newPos.rotation,
                fontSize: newPos.fontSize
            }
        });
    } else if (shape.type === 'image') {
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
    } else if (shape.shapeName === 'arrow') {
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                startPoint: { x: oldPos.startPoint.x, y: oldPos.startPoint.y },
                endPoint: { x: oldPos.endPoint.x, y: oldPos.endPoint.y },
                controlPoint1: oldPos.controlPoint1 ? { x: oldPos.controlPoint1.x, y: oldPos.controlPoint1.y } : null,
                controlPoint2: oldPos.controlPoint2 ? { x: oldPos.controlPoint2.x, y: oldPos.controlPoint2.y } : null
            },
            newPos: {
                startPoint: { x: newPos.startPoint.x, y: newPos.startPoint.y },
                endPoint: { x: newPos.endPoint.x, y: newPos.endPoint.y },
                controlPoint1: newPos.controlPoint1 ? { x: newPos.controlPoint1.x, y: newPos.controlPoint1.y } : null,
                controlPoint2: newPos.controlPoint2 ? { x: newPos.controlPoint2.x, y: newPos.controlPoint2.y } : null
            }
        });
    } else if (shape.shapeName === 'freehandStroke') {
        undoStack.push({
            type: 'transform',
            shape: shape,
            oldPos: {
                points: JSON.parse(JSON.stringify(oldPos.points)),
                rotation: oldPos.rotation
            },
            newPos: {
                points: JSON.parse(JSON.stringify(newPos.points)),
                rotation: newPos.rotation
            }
        });
    } else if (shape.shapeName === "rectangle") {
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
        if (action.shape.type === 'text') {
            // Handle text creation undo
            if (action.shape.element.parentNode) {
                action.shape.element.parentNode.removeChild(action.shape.element);
            }
        }
        else if (action.shape.type === 'image') {
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
        if (action.shape.type === 'text') {
            // Handle text deletion undo
            if (svg) {
                svg.appendChild(action.shape.element);
            }
        } else if (action.shape.type === 'image') {
            // Handle image deletion undo
            action.shape.restore();
        } else {
            // Handle other shape deletion undo
            shapes.push(action.shape);
            if (svg) {
                svg.appendChild(action.shape.group);
            }
        }
        redoStack.push(action);
    }
    else if (action.type === 'transform') {
        if (action.shape.type === 'text') {
            // Handle text transform undo
            const textElement = action.shape.element.querySelector('text');
            if (textElement && action.oldPos.fontSize !== undefined) {
                textElement.setAttribute('font-size', action.oldPos.fontSize + 'px');
            }
            
            // Restore position and rotation
            const centerX = textElement ? textElement.getBBox().x + textElement.getBBox().width / 2 : 0;
            const centerY = textElement ? textElement.getBBox().y + textElement.getBBox().height / 2 : 0;
            
            action.shape.element.setAttribute('transform', 
                `translate(${action.oldPos.x}, ${action.oldPos.y}) rotate(${action.oldPos.rotation}, ${centerX}, ${centerY})`
            );
            
            action.shape.element.setAttribute('data-x', action.oldPos.x);
            action.shape.element.setAttribute('data-y', action.oldPos.y);
            
            // Update feedback if selected
            if (selectedElement === action.shape.element && updateSelectionFeedback) {
                setTimeout(updateSelectionFeedback, 0);
            }
        } else if (action.shape.type === 'image') {
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
        } else if (action.shape.shapeName === 'arrow') {
            // Handle arrow transform undo - direct deselection logic
            action.shape.startPoint = { x: action.oldPos.startPoint.x, y: action.oldPos.startPoint.y };
            action.shape.endPoint = { x: action.oldPos.endPoint.x, y: action.oldPos.endPoint.y };
            action.shape.controlPoint1 = action.oldPos.controlPoint1 ? 
                { x: action.oldPos.controlPoint1.x, y: action.oldPos.controlPoint1.y } : null;
            action.shape.controlPoint2 = action.oldPos.controlPoint2 ? 
                { x: action.oldPos.controlPoint2.x, y: action.oldPos.controlPoint2.y } : null;
            action.shape.isSelected = false;
            action.shape.draw();
        } else if (action.shape.shapeName === 'freehandStroke') {
            // Handle freehand stroke transform undo
            action.shape.points = JSON.parse(JSON.stringify(action.oldPos.points));
            action.shape.rotation = action.oldPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if (action.shape.shapeName === "rectangle") {
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
        if (action.shape.type === 'text') {
            // Handle text options change undo
            const textElement = action.shape.element.querySelector('text');
            if (textElement) {
                if (action.oldOptions.color) textElement.setAttribute('fill', action.oldOptions.color);
                if (action.oldOptions.font) textElement.setAttribute('font-family', action.oldOptions.font);
                if (action.oldOptions.size) textElement.setAttribute('font-size', action.oldOptions.size);
                if (action.oldOptions.align) textElement.setAttribute('text-anchor', action.oldOptions.align);
                
                // Update feedback if selected
                if (selectedElement === action.shape.element && updateSelectionFeedback) {
                    setTimeout(updateSelectionFeedback, 0);
                }
            }
        } else if (action.shape.shapeName === 'arrow') {
            // Handle arrow options change undo
            action.shape.options = { ...action.oldOptions };
            action.shape.arrowOutlineStyle = action.oldOptions.arrowOutlineStyle;
            action.shape.arrowHeadStyle = action.oldOptions.arrowHeadStyle;
            action.shape.arrowCurved = action.oldOptions.arrowCurved;
            action.shape.arrowCurveAmount = action.oldOptions.arrowCurveAmount;
            action.shape.draw();
        } else {
            // Handle other shape options change undo
            action.shape.options = action.oldOptions;
            action.shape.draw();
        }
        redoStack.push(action);
    }
}

export function redo() {
    if (redoStack.length === 0) return;
    const action = redoStack.pop();
    
    if (action.type === 'create') {
        if (action.shape.type === 'text') {
            // Handle text creation redo
            if (svg) {
                svg.appendChild(action.shape.element);
            }
        }
        else if (action.shape.type === 'image') {
            // Handle image creation redo
            action.shape.restore();
        } else {
            // Handle other shape creation redo
            shapes.push(action.shape);
            if (svg) {
                svg.appendChild(action.shape.group);
            }
        }
        undoStack.push(action);
    } else if (action.type === 'delete') {
        if (action.shape.type === 'text') {
            // Handle text deletion redo
            if (action.shape.element.parentNode) {
                action.shape.element.parentNode.removeChild(action.shape.element);
            }
        }
        else if (action.shape.type === 'image') {
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
        if (action.shape.type === 'text') {
            // Handle text transform redo
            const textElement = action.shape.element.querySelector('text');
            if (textElement && action.newPos.fontSize !== undefined) {
                textElement.setAttribute('font-size', action.newPos.fontSize + 'px');
            }
            
            // Restore position and rotation
            const centerX = textElement ? textElement.getBBox().x + textElement.getBBox().width / 2 : 0;
            const centerY = textElement ? textElement.getBBox().y + textElement.getBBox().height / 2 : 0;
            
            action.shape.element.setAttribute('transform', 
                `translate(${action.newPos.x}, ${action.newPos.y}) rotate(${action.newPos.rotation}, ${centerX}, ${centerY})`
            );
            
            action.shape.element.setAttribute('data-x', action.newPos.x);
            action.shape.element.setAttribute('data-y', action.newPos.y);
            
            // Update feedback if selected
            if (selectedElement === action.shape.element && updateSelectionFeedback) {
                setTimeout(updateSelectionFeedback, 0);
            }
        } else if (action.shape.type === 'image') {
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
        } else if (action.shape.shapeName === 'arrow') {
            // Handle arrow transform redo - direct deselection logic
            action.shape.startPoint = { x: action.newPos.startPoint.x, y: action.newPos.startPoint.y };
            action.shape.endPoint = { x: action.newPos.endPoint.x, y: action.newPos.endPoint.y };
            action.shape.controlPoint1 = action.newPos.controlPoint1 ? 
                { x: action.newPos.controlPoint1.x, y: action.newPos.controlPoint1.y } : null;
            action.shape.controlPoint2 = action.newPos.controlPoint2 ? 
                { x: action.newPos.controlPoint2.x, y: action.newPos.controlPoint2.y } : null;
            action.shape.isSelected = false;
            action.shape.draw();
        } else if (action.shape.shapeName === 'freehandStroke') {
            // Handle freehand stroke transform redo
            action.shape.points = JSON.parse(JSON.stringify(action.newPos.points));
            action.shape.rotation = action.newPos.rotation;
            action.shape.isSelected = false;
            if (typeof action.shape.removeSelection === 'function') action.shape.removeSelection();
            action.shape.draw();
        } else if (action.shape.shapeName === "rectangle") {
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
    else if (action.type === 'optionsChange') {
        if (action.shape.type === 'text') {
            // Handle text options change redo
            const textElement = action.shape.element.querySelector('text');
            if (textElement) {
                if (action.newOptions.color) textElement.setAttribute('fill', action.newOptions.color);
                if (action.newOptions.font) textElement.setAttribute('font-family', action.newOptions.font);
                if (action.newOptions.size) textElement.setAttribute('font-size', action.newOptions.size);
                if (action.newOptions.align) textElement.setAttribute('text-anchor', action.newOptions.align);
                
                // Update feedback if selected
                if (selectedElement === action.shape.element && updateSelectionFeedback) {
                    setTimeout(updateSelectionFeedback, 0);
                }
            }
        } else if (action.shape.shapeName === 'arrow') {
            // Handle arrow options change redo - we need to get current options as newOptions
            const currentOptions = {
                ...action.shape.options,
                arrowOutlineStyle: action.shape.arrowOutlineStyle,
                arrowHeadStyle: action.shape.arrowHeadStyle,
                arrowCurved: action.shape.arrowCurved,
                arrowCurveAmount: action.shape.arrowCurveAmount
            };
            
            // Store current state for potential future undo
            action.newOptions = currentOptions;
            
            action.shape.draw();
        } else {
            // Handle other shape options change redo - we need to get current options as newOptions
            action.newOptions = action.shape.options;
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