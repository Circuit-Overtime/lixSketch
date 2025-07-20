import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction, pushFrameAttachmentAction } from './undoAndRedo.js';

// Update event handlers to use the Line class
let isDrawingLine = false;
let currentLine = null;
let lineStartX = 0;      
let lineStartY = 0;      
let currentLineGroup = null;    
let lineColor = "#fff";
let lineStrokeWidth = 3;
let lineStrokeStyle = "solid";
let lineEdgeType = 1;
let lineSktetchRate = 3;

let isDraggingLine = false;
let dragOldPosLine = null;
let copiedShapeData = null;

// Frame attachment variables
let draggedShapeInitialFrameLine = null;
let hoveredFrameLine = null;

let startX, startY;

let lineColorOptions = document.querySelectorAll(".lineColor > span");
let lineThicknessOptions = document.querySelectorAll(".lineThicknessSpan");
let lineOutlineOptions = document.querySelectorAll(".lineStyleSpan");
let lineSlopeOptions = document.querySelectorAll(".lineSlopeSpan");
let lineEdgeOptions = document.querySelectorAll(".lineEdgeSpan");


function getSVGCoordsFromMouse(e) {
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}

class Line {
    constructor(startPoint, endPoint, options = {}) {
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.options = { ...options };
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        this.selectionOutline = null;
        this.shapeName = "line"; 
        this.shapeID = `line-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`; 
        this.group.setAttribute('id', this.shapeID);
        
        // Frame attachment properties
        this.parentFrame = null;
        
        svg.appendChild(this.group);
        this.draw();
    }

    // Add position and dimension properties for frame compatibility
    get x() {
        return Math.min(this.startPoint.x, this.endPoint.x);
    }
    
    set x(value) {
        const currentX = this.x;
        const dx = value - currentX;
        this.startPoint.x += dx;
        this.endPoint.x += dx;
    }
    
    get y() {
        return Math.min(this.startPoint.y, this.endPoint.y);
    }
    
    set y(value) {
        const currentY = this.y;
        const dy = value - currentY;
        this.startPoint.y += dy;
        this.endPoint.y += dy;
    }
    
    get width() {
        return Math.abs(this.endPoint.x - this.startPoint.x);
    }
    
    set width(value) {
        const centerX = (this.startPoint.x + this.endPoint.x) / 2;
        this.startPoint.x = centerX - value / 2;
        this.endPoint.x = centerX + value / 2;
    }
    
    get height() {
        return Math.abs(this.endPoint.y - this.startPoint.y);
    }
    
    set height(value) {
        const centerY = (this.startPoint.y + this.endPoint.y) / 2;
        this.startPoint.y = centerY - value / 2;
        this.endPoint.y = centerY + value / 2;
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }

        const rc = rough.svg(svg);
        const line = rc.line(
            this.startPoint.x, this.startPoint.y,
            this.endPoint.x, this.endPoint.y,
            this.options
        );
        this.element = line;
        this.group.appendChild(line);

        if (this.isSelected) {
            this.addAnchors();
        }
    }

    selectLine() {
        this.isSelected = true;
        this.draw();
    }

    deselectLine() {
        this.isSelected = false;
        this.anchors = [];
        this.draw();
    }

    // Add removeSelection method like in Circle class
    removeSelection() {
        this.anchors.forEach(anchor => {
            if (anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });
        this.anchors = [];
        this.isSelected = false;
    }

    addAnchors() {
        const anchorSize = 10 / currentZoom;
        const anchorStrokeWidth = 2 / currentZoom;
        [this.startPoint, this.endPoint].forEach((point, index) => {
            const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            anchor.setAttribute('cx', point.x);
            anchor.setAttribute('cy', point.y);
            anchor.setAttribute('r', anchorSize);
            anchor.setAttribute('fill', '#121212');
            anchor.setAttribute('stroke', '#5B57D1');
            anchor.setAttribute('stroke-width', anchorStrokeWidth);
            anchor.setAttribute('class', 'anchor line-anchor');
            anchor.style.cursor = 'grab';
            anchor.style.pointerEvents = 'all';
            anchor.dataset.index = index;
            anchor.addEventListener('pointerdown', (e) => this.startAnchorDrag(e, index));
            this.group.appendChild(anchor);
            this.anchors[index] = anchor;
        });
    }

    startAnchorDrag(e, index) {
        e.stopPropagation();
        
        // Store old position for undo
        dragOldPosLine = {
            startPoint: { x: this.startPoint.x, y: this.startPoint.y },
            endPoint: { x: this.endPoint.x, y: this.endPoint.y },
            parentFrame: this.parentFrame
        };

        const onPointerMove = (event) => {
            const { x, y } = getSVGCoordsFromMouse(event);
            this.updatePosition(index, x, y);
        };
        const onPointerUp = () => {
            console.log(dragOldPosLine);
            if (dragOldPosLine) {
                const newPos = {
                    startPoint: { x: this.startPoint.x, y: this.startPoint.y },
                    endPoint: { x: this.endPoint.x, y: this.endPoint.y },
                    parentFrame: this.parentFrame
                };
                console.log(newPos);
                pushTransformAction(this, dragOldPosLine, newPos);
                dragOldPosLine = null;
            }
            
            svg.removeEventListener('pointermove', onPointerMove);
            svg.removeEventListener('pointerup', onPointerUp);
        };
        
        svg.addEventListener('pointermove', onPointerMove);
        svg.addEventListener('pointerup', onPointerUp);
    }

    updatePosition(anchorIndex, newX, newY) {
        if (anchorIndex === 0) {
            this.startPoint.x = newX;
            this.startPoint.y = newY;
        } else {
            this.endPoint.x = newX;
            this.endPoint.y = newY;
        }
        this.draw();
    }

    // Add move method for dragging the entire line
    move(dx, dy) {
        this.startPoint.x += dx;
        this.startPoint.y += dy;
        this.endPoint.x += dx;
        this.endPoint.y += dy;
        
        // Only update frame containment if we're actively dragging the shape itself
        // and not being moved by a parent frame
        if (isDraggingLine && !this.isBeingMovedByFrame) {
            this.updateFrameContainment();
        }
    }

    updateFrameContainment() {
        // Don't update if we're being moved by a frame
        if (this.isBeingMovedByFrame) return;
        
        let targetFrame = null;
        
        // Find which frame this shape is over
        shapes.forEach(shape => {
            if (shape.shapeName === 'frame' && shape.isShapeInFrame(this)) {
                targetFrame = shape;
            }
        });
        
        // If we have a parent frame and we're being dragged, temporarily remove clipping
        if (this.parentFrame && isDraggingLine) {
            this.parentFrame.temporarilyRemoveFromFrame(this);
        }
        
        // Update frame highlighting
        if (hoveredFrameLine && hoveredFrameLine !== targetFrame) {
            hoveredFrameLine.removeHighlight();
        }
        
        if (targetFrame && targetFrame !== hoveredFrameLine) {
            targetFrame.highlightFrame();
        }
        
        hoveredFrameLine = targetFrame;
    }

    contains(x, y) {
        const tolerance = 5 / currentZoom;
        return this.pointToLineDistance(x, y, this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y) <= tolerance;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
}

// Add delete functionality
function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'line') {
        const idx = shapes.indexOf(currentShape);
        if (idx !== -1) shapes.splice(idx, 1);
        if (currentShape.group.parentNode) {
            currentShape.group.parentNode.removeChild(currentShape.group);
        }
        pushDeleteAction(currentShape);
        currentShape = null;
        disableAllSideBars();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && currentShape && currentShape.shapeName === 'line') {
        deleteCurrentShape();
    }
});

const handleMouseDown = (e) => {
    if (!isLineToolActive && !isSelectionToolActive) return;

    const { x, y } = getSVGCoordsFromMouse(e);

    if (isLineToolActive) {
        isDrawingLine = true;
        currentLine = new Line(
            { x, y },
            { x, y },
            {
                stroke: lineColor,
                strokeWidth: lineStrokeWidth,
                roughness: lineSktetchRate,
                bowing: lineEdgeType,
                strokeDasharray: lineStrokeStyle === "dashed" ? "5,5" : (lineStrokeStyle === "dotted" ? "2,12" : "")
            }
        );
        shapes.push(currentLine);
        currentShape = currentLine;
    } else if (isSelectionToolActive) {
        let clickedOnShape = false;
        
        // Check if clicking on current selected line
        if (currentShape && currentShape.shapeName === 'line' && currentShape.isSelected) {
            if (currentShape.contains(x, y)) {
                isDraggingLine = true;
                dragOldPosLine = {
                    startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
                    parentFrame: currentShape.parentFrame
                };
                
                // Store initial frame state
                draggedShapeInitialFrameLine = currentShape.parentFrame || null;
                
                // Temporarily remove from frame clipping if dragging
                if (currentShape.parentFrame) {
                    currentShape.parentFrame.temporarilyRemoveFromFrame(currentShape);
                }
                
                startX = x;
                startY = y;
                clickedOnShape = true;
            }
        }

        // If not clicking on selected shape, check for other shapes
        if (!clickedOnShape) {
            let shapeToSelect = null;
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape instanceof Line && shape.contains(x, y)) {
                    shapeToSelect = shape;
                    break;
                }
            }

            if (currentShape && currentShape !== shapeToSelect) {
                currentShape.deselectLine();
                currentShape = null;
            }

            if (shapeToSelect) {
                currentShape = shapeToSelect;
                currentShape.selectLine();
                isDraggingLine = true;
                dragOldPosLine = {
                    startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
                    parentFrame: currentShape.parentFrame
                };
                
                // Store initial frame state
                draggedShapeInitialFrameLine = currentShape.parentFrame || null;
                
                // Temporarily remove from frame clipping if dragging
                if (currentShape.parentFrame) {
                    currentShape.parentFrame.temporarilyRemoveFromFrame(currentShape);
                }
                
                startX = x;
                startY = y;
                clickedOnShape = true;
            }
        }

        if (!clickedOnShape && currentShape) {
            currentShape.deselectLine();
            currentShape = null;
        }
    }
};

const handleMouseMove = (e) => {
    const { x, y } = getSVGCoordsFromMouse(e);
    
    // Keep lastMousePos in screen coordinates for other functions
    const svgRect = svg.getBoundingClientRect();
    lastMousePos = {
        x: e.clientX - svgRect.left, 
        y: e.clientY - svgRect.top
    };
    
    if (isDrawingLine && currentLine) {
        currentLine.endPoint = { x, y };
        currentLine.draw();
        
        // Check for frame containment while drawing (but don't apply clipping yet)
        shapes.forEach(frame => {
            if (frame.shapeName === 'frame') {
                if (frame.isShapeInFrame(currentLine)) {
                    frame.highlightFrame();
                    hoveredFrameLine = frame;
                } else if (hoveredFrameLine === frame) {
                    frame.removeHighlight();
                    hoveredFrameLine = null;
                }
            }
        });
    } else if (isDraggingLine && currentShape && currentShape.isSelected) {
        const dx = x - startX;
        const dy = y - startY;
        currentShape.move(dx, dy);
        startX = x;
        startY = y;
        currentShape.draw();
    }
};

const handleMouseUp = (e) => {
    if (isDrawingLine) {
        isDrawingLine = false;
        
        // Check if line is too small
        const dx = currentLine.endPoint.x - currentLine.startPoint.x;
        const dy = currentLine.endPoint.y - currentLine.startPoint.y;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq < (5 / currentZoom) ** 2) {
            shapes.pop();
            if (currentLine.group.parentNode) {
                currentLine.group.parentNode.removeChild(currentLine.group);
            }
            currentLine = null;
            currentShape = null;
        } else {
            // Push create action for undo/redo
            pushCreateAction(currentLine);
            
            // Check for frame containment and track attachment
            const finalFrame = hoveredFrameLine;
            if (finalFrame) {
                finalFrame.addShapeToFrame(currentLine);
                // Track the attachment for undo
                pushFrameAttachmentAction(finalFrame, currentLine, 'attach', null);
            }
        }
        
        // Clear frame highlighting
        if (hoveredFrameLine) {
            hoveredFrameLine.removeHighlight();
            hoveredFrameLine = null;
        }
        
        currentLine = null;
    }
    
    if (isDraggingLine && dragOldPosLine && currentShape) {
        const newPos = {
            startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
            endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y },
            parentFrame: currentShape.parentFrame
        };
        const oldPos = {
            ...dragOldPosLine,
            parentFrame: draggedShapeInitialFrameLine
        };
        
        const stateChanged = dragOldPosLine.startPoint.x !== newPos.startPoint.x || 
                           dragOldPosLine.startPoint.y !== newPos.startPoint.y ||
                           dragOldPosLine.endPoint.x !== newPos.endPoint.x || 
                           dragOldPosLine.endPoint.y !== newPos.endPoint.y;

        const frameChanged = oldPos.parentFrame !== newPos.parentFrame;
        
        if (stateChanged || frameChanged) {
            pushTransformAction(currentShape, oldPos, newPos);
        }
        
        // Handle frame containment changes after drag
        if (isDraggingLine) {
            const finalFrame = hoveredFrameLine;
            
            // If shape moved to a different frame
            if (draggedShapeInitialFrameLine !== finalFrame) {
                // Remove from initial frame
                if (draggedShapeInitialFrameLine) {
                    draggedShapeInitialFrameLine.removeShapeFromFrame(currentShape);
                }
                
                // Add to new frame
                if (finalFrame) {
                    finalFrame.addShapeToFrame(currentShape);
                }
                
                // Track the frame change for undo
                if (frameChanged) {
                    pushFrameAttachmentAction(finalFrame || draggedShapeInitialFrameLine, currentShape, 
                        finalFrame ? 'attach' : 'detach', draggedShapeInitialFrameLine);
                }
            } else if (draggedShapeInitialFrameLine) {
                // Shape stayed in same frame, restore clipping
                draggedShapeInitialFrameLine.restoreToFrame(currentShape);
            }
        }
        
        dragOldPosLine = null;
        draggedShapeInitialFrameLine = null;
    }
    
    // Clear frame highlighting
    if (hoveredFrameLine) {
        hoveredFrameLine.removeHighlight();
        hoveredFrameLine = null;
    }
    
    isDraggingLine = false;
};

// --- Event Handlers ---

// --- Style Option Event Listeners ---
lineColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            const oldOptions = {...currentShape.options};
            currentShape.options.stroke = span.getAttribute("data-id");
            currentShape.draw();
            pushOptionsChangeAction(currentShape, oldOptions);
        } else {
            lineColor = span.getAttribute("data-id");
        }
    });
});

lineThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineThicknessOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            const oldOptions = {...currentShape.options};
            currentShape.options.strokeWidth = parseInt(span.getAttribute("data-id"));
            currentShape.draw();
            pushOptionsChangeAction(currentShape, oldOptions);
        } else {
            lineStrokeWidth = parseInt(span.getAttribute("data-id"));
        }
    });
});

lineOutlineOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineOutlineOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            const oldOptions = {...currentShape.options};
            const style = span.getAttribute("data-id");
            currentShape.options.strokeDasharray = 
                style === "dashed" ? "5,5" : 
                (style === "dotted" ? "2,12" : "");
            currentShape.draw();
            pushOptionsChangeAction(currentShape, oldOptions);
        } else {
            lineStrokeStyle = span.getAttribute("data-id");
        }
    });
});

lineSlopeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineSlopeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            const oldOptions = {...currentShape.options};
            currentShape.options.roughness = parseFloat(span.getAttribute("data-id"));
            currentShape.draw();
            pushOptionsChangeAction(currentShape, oldOptions);
        } else {
            lineSktetchRate = parseFloat(span.getAttribute("data-id"));
        }
    });
});

lineEdgeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        lineEdgeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        
        if (currentShape instanceof Line && currentShape.isSelected) {
            const oldOptions = {...currentShape.options};
            currentShape.options.bowing = parseFloat(span.getAttribute("data-id"));
            currentShape.draw();
            pushOptionsChangeAction(currentShape, oldOptions);
        } else {
            lineEdgeType = parseFloat(span.getAttribute("data-id"));
        }
    });
});

// Add copy/paste functionality
function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneLineData(line) {
    return {
        startPoint: { x: line.startPoint.x, y: line.startPoint.y },
        endPoint: { x: line.endPoint.x, y: line.endPoint.y },
        options: cloneOptions(line.options)
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'line' && currentShape.isSelected) {
            copiedShapeData = cloneLineData(currentShape);
        }
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedShapeData) {
            e.preventDefault();
            let pasteX, pasteY;
            if (lastMousePos && typeof lastMousePos.x === 'number' && typeof lastMousePos.y === 'number') {
                const svgPoint = svg.createSVGPoint();
                svgPoint.x = lastMousePos.x;
                svgPoint.y = lastMousePos.y;
                const CTM = svg.getScreenCTM().inverse();
                const userPoint = svgPoint.matrixTransform(CTM);
                pasteX = userPoint.x;
                pasteY = userPoint.y;
            } else {
                const svgRect = svg.getBoundingClientRect();
                pasteX = svgRect.width / 2;
                pasteY = svgRect.height / 2;
                const svgPoint = svg.createSVGPoint();
                svgPoint.x = pasteX;
                svgPoint.y = pasteY;
                const CTM = svg.getScreenCTM().inverse();
                const userPoint = svgPoint.matrixTransform(CTM);
                pasteX = userPoint.x;
                pasteY = userPoint.y;
            }

            shapes.forEach(shape => {
                if (shape.isSelected) {
                    shape.removeSelection();
                }
            });

            currentShape = null;
            disableAllSideBars();
            
            const offset = 20;
            const newLine = new Line(
                { x: copiedShapeData.startPoint.x + offset, y: copiedShapeData.startPoint.y + offset },
                { x: copiedShapeData.endPoint.x + offset, y: copiedShapeData.endPoint.y + offset },
                cloneOptions(copiedShapeData.options)
            );
            
            shapes.push(newLine);
            newLine.isSelected = true;
            currentShape = newLine;
            newLine.draw();
            pushCreateAction(newLine);
        }
    }
});

export {
    handleMouseDown as handleMouseDownLine,
    handleMouseMove as handleMouseMoveLine,
    handleMouseUp as handleMouseUpLine,
}