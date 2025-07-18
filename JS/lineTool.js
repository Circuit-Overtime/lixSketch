import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';

// Update event handlers to use the Line class
let isDrawingLine = false;
let currentLine = null;
let lineStartX = 0;       // Starting X coordinate of the line
let lineStartY = 0;       // Starting Y coordinate of the line
let currentLineGroup = null;    // Reference to the current line element being drawn
let lineColor = "#fff";
let lineStrokeWidth = 3;
let lineStrokeStyle = "solid";
let lineEdgeType = 1;
let lineSktetchRate = 3;

// Add variables for dragging functionality
let isDraggingLine = false;
let dragOldPosLine = null;
let copiedShapeData = null;

let startX, startY;

let lineColorOptions = document.querySelectorAll(".lineColor > span");
let lineThicknessOptions = document.querySelectorAll(".lineThicknessSpan");
let lineOutlineOptions = document.querySelectorAll(".lineStyleSpan");
let lineSlopeOptions = document.querySelectorAll(".lineSlopeSpan");
let lineEdgeOptions = document.querySelectorAll(".lineEdgeSpan");

// Add coordinate conversion function like in drawCircle.js
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
        this.shapeName = "line"; // Add shapeName property
        svg.appendChild(this.group);
        this.draw();
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
            endPoint: { x: this.endPoint.x, y: this.endPoint.y }
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
                    endPoint: { x: this.endPoint.x, y: this.endPoint.y }
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
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
                };
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
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
                };
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
    
    if (isDrawingLine && currentLine) {
        currentLine.endPoint = { x, y };
        currentLine.draw();
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
        }
        
        currentLine = null;
    }
    
    if (isDraggingLine && dragOldPosLine && currentShape) {
        const newPos = {
            startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
            endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
        };
        const stateChanged = dragOldPosLine.startPoint.x !== newPos.startPoint.x || 
                           dragOldPosLine.startPoint.y !== newPos.startPoint.y ||
                           dragOldPosLine.endPoint.x !== newPos.endPoint.x || 
                           dragOldPosLine.endPoint.y !== newPos.endPoint.y;
        
        if (stateChanged) {
            pushTransformAction(currentShape, dragOldPosLine, newPos);
        }
        dragOldPosLine = null;
    }
    
    isDraggingLine = false;
};

// --- Event Handlers ---

svg.addEventListener("mousedown", handleMouseDown);
svg.addEventListener("mousemove", handleMouseMove);
svg.addEventListener("mouseup", handleMouseUp);

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
