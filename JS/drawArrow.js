import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';

let arrowStartX, arrowStartY;
let currentArrow = null; 
let isResizing = false;  
let isDragging = false;  
let activeAnchor = null; 
let isDrawingArrow = false; 
let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid";
let arrowCurved = false;
let arrowCurveAmount = 20;
let arrowHeadLength = 10;
let arrowHeadAngleDeg = 30;
let arrowHeadStyle = "default";
let startX, startY; 
let startViewBoxX, startViewBoxY, dragOffsetX, dragOffsetY; 
let dragOldPosArrow = null;
let copiedShapeData = null;

let arrowStrokeColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowTypeStyleValue = document.querySelectorAll(".arrowTypeStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyleSpan");

// Add coordinate conversion function like in lineTool.js
function getSVGCoordsFromMouse(e) {
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}

class Arrow {
    constructor(startPoint, endPoint, options = {}) {
        this.startPoint = startPoint; 
        this.endPoint = endPoint;   
        this.options = {
            stroke: options.stroke || arrowStrokeColor,
            strokeWidth: options.strokeWidth || arrowStrokeThickness,
            strokeDasharray: options.arrowOutlineStyle === "dashed" ? "10,10" : (options.arrowOutlineStyle === "dotted" ? "2,8" : ""),
            fill: 'none', 
            ...options 
        };
        this.arrowOutlineStyle = options.arrowOutlineStyle || arrowOutlineStyle;
        this.arrowHeadStyle = options.arrowHeadStyle || arrowHeadStyle;
        this.arrowHeadLength = parseFloat(options.arrowHeadLength || arrowHeadLength);
        this.arrowHeadAngleDeg = parseFloat(options.arrowHeadAngleDeg || arrowHeadAngleDeg);

        this.element = null; 
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false; 
        this.anchors = [];
        this.shapeName = "arrow"; // Add shapeName property like in lineTool.js

        svg.appendChild(this.group);
        this.draw(); 
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        this.anchors = []; 

        let pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${this.endPoint.x} ${this.endPoint.y}`;

        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const length = Math.sqrt(dx*dx + dy*dy);

        if (this.arrowHeadStyle === "default" && length > 0.1) { 
            const arrowHeadAngleRad = (this.arrowHeadAngleDeg * Math.PI) / 180;
            const angle = Math.atan2(dy, dx); 
            const x3 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle - arrowHeadAngleRad);
            const y3 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle - arrowHeadAngleRad);
            const x4 = this.endPoint.x - this.arrowHeadLength * Math.cos(angle + arrowHeadAngleRad);
            const y4 = this.endPoint.y - this.arrowHeadLength * Math.sin(angle + arrowHeadAngleRad);
            pathData += ` M ${x3} ${y3} L ${this.endPoint.x} ${this.endPoint.y} L ${x4} ${y4}`;
        }

        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", pathData);
        arrowPath.setAttribute("stroke", this.isSelected ? "#5B57D1" : this.options.stroke);
        arrowPath.setAttribute("stroke-width", this.options.strokeWidth);
        arrowPath.setAttribute("fill", this.options.fill); 

        if (this.options.strokeDasharray) {
             arrowPath.setAttribute("stroke-dasharray", this.options.strokeDasharray);
        } else {
             arrowPath.removeAttribute("stroke-dasharray"); 
        }

        arrowPath.setAttribute("stroke-linecap", "round");
        arrowPath.setAttribute("stroke-linejoin", "round");
        arrowPath.classList.add("arrow-path");

        this.element = arrowPath;
        this.group.appendChild(this.element); 

        if (this.isSelected) {
            this.addAnchors();
        }
    }

    // Add selection methods like in lineTool.js
    selectArrow() {
        this.isSelected = true;
        this.draw();
    }

    deselectArrow() {
        this.isSelected = false;
        this.anchors = [];
        this.draw();
    }

    // Add removeSelection method like in lineTool.js
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
        const anchorSize = 5 / currentZoom;
        const anchorStrokeWidth = 2 / currentZoom;
        
        // --- FIXED: Calculate proper offset to position anchor above the arrowhead ---
        const arrowAngle = Math.atan2(this.endPoint.y - this.startPoint.y, this.endPoint.x - this.startPoint.x);
        
        // Calculate offset distance to clear the arrowhead
        const arrowHeadClearance = this.arrowHeadLength + anchorSize - 10;
        
        // Position anchor opposite to arrow direction (behind the arrowhead)
        const offsetEndAnchor = {
            x: this.endPoint.x + arrowHeadClearance * Math.cos(arrowAngle),
            y: this.endPoint.y + arrowHeadClearance * Math.sin(arrowAngle)
        };
        
        // Use original startPoint and calculated offset position for end anchor
        const anchorPositions = [this.startPoint, offsetEndAnchor];
    
        anchorPositions.forEach((point, index) => {
            const anchor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            anchor.setAttribute("cx", point.x);
            anchor.setAttribute("cy", point.y);
            anchor.setAttribute("r", anchorSize); 
            anchor.setAttribute("fill", "#121212");
            anchor.setAttribute("stroke", "#5B57D1");
            anchor.setAttribute("stroke-width", anchorStrokeWidth); 
            anchor.setAttribute("class", "anchor arrow-anchor"); 
            anchor.setAttribute("data-index", index); 
            anchor.style.cursor = "grab"; 
            anchor.style.pointerEvents = "all"; 
            anchor.addEventListener('pointerdown', (e) => this.startAnchorDrag(e, index));
    
            this.group.appendChild(anchor); 
            this.anchors[index] = anchor;   
        });
    }
    
    isNearAnchor(x, y) {
        const anchorSize = 10 / currentZoom;
        
        // Check anchors
        for (let i = 0; i < this.anchors.length; i++) {
            const anchor = this.anchors[i];
            if (anchor) {
                const anchorX = parseFloat(anchor.getAttribute('cx'));
                const anchorY = parseFloat(anchor.getAttribute('cy'));
                const distance = Math.sqrt(Math.pow(x - anchorX, 2) + Math.pow(y - anchorY, 2));
                if (distance <= anchorSize) {
                    return { type: 'anchor', index: i };
                }
            }
        }
        
        return null;
    }

    startAnchorDrag(e, index) {
        e.stopPropagation();
        e.preventDefault(); // --- ADDED: Prevent default behavior
        
        // Store old position for undo
        dragOldPosArrow = {
            startPoint: { x: this.startPoint.x, y: this.startPoint.y },
            endPoint: { x: this.endPoint.x, y: this.endPoint.y }
        };

        const onPointerMove = (event) => {
            const { x, y } = getSVGCoordsFromMouse(event);
            this.updatePosition(index, x, y);
        };
        
        const onPointerUp = () => {
            if (dragOldPosArrow) {
                const newPos = {
                    startPoint: { x: this.startPoint.x, y: this.startPoint.y },
                    endPoint: { x: this.endPoint.x, y: this.endPoint.y }
                };
                pushTransformAction(this, dragOldPosArrow, newPos);
                dragOldPosArrow = null;
            }
            
            svg.removeEventListener('pointermove', onPointerMove);
            svg.removeEventListener('pointerup', onPointerUp);
        };
        
        svg.addEventListener('pointermove', onPointerMove);
        svg.addEventListener('pointerup', onPointerUp);
    }

    move(dx, dy) {
        this.startPoint.x += dx;
        this.startPoint.y += dy;
        this.endPoint.x += dx;
        this.endPoint.y += dy;
    }

    updatePosition(anchorIndex, newViewBoxX, newViewBoxY) {
        if (anchorIndex === 0) { 
            this.startPoint.x = newViewBoxX;
            this.startPoint.y = newViewBoxY;
        } else if (anchorIndex === 1) { 
            this.endPoint.x = newViewBoxX;
            this.endPoint.y = newViewBoxY;
        }
        this.draw();
    }

    contains(viewBoxX, viewBoxY) {
        // Improved tolerance based on stroke width and zoom
        const tolerance = Math.max(5, this.options.strokeWidth * 2) / currentZoom;
        const distance = this.pointToLineDistance(viewBoxX, viewBoxY, this.startPoint.x, this.startPoint.y, this.endPoint.x, this.endPoint.y);
        return distance <= tolerance;
    }

    pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        // Calculate the parameter t for the closest point on the line segment
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        // Find the closest point on the line segment
        if (param < 0) {
            // Closest point is before the start of the segment
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            // Closest point is after the end of the segment
            xx = x2;
            yy = y2;
        } else {
            // Closest point is on the segment
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        // Return the distance from the point to the closest point on the line
        const dx = x - xx;
        const dy = y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateStyle(newOptions) {
        if (newOptions.arrowOutlineStyle !== undefined) {
            this.arrowOutlineStyle = newOptions.arrowOutlineStyle; 
            const style = this.arrowOutlineStyle;
            this.options.strokeDasharray = style === "dashed" ? "10,10" : (style === "dotted" ? "2,8" : "");
        }
        if (newOptions.arrowHeadStyle !== undefined) {
            this.arrowHeadStyle = newOptions.arrowHeadStyle;
        }
        if (newOptions.stroke !== undefined) {
            this.options.stroke = newOptions.stroke;
        }
        if (newOptions.strokeWidth !== undefined) {
            this.options.strokeWidth = parseFloat(newOptions.strokeWidth); 
        }

        Object.keys(newOptions).forEach(key => newOptions[key] === undefined && delete newOptions[key]);

        this.options = { ...this.options, ...newOptions };

        if (this.arrowOutlineStyle === 'solid' && this.options.strokeDasharray) {
             delete this.options.strokeDasharray;
        }

        this.draw(); 
    }

    destroy() {
        if (this.group && this.group.parentNode) {
            this.group.parentNode.removeChild(this.group);
        }
        const index = shapes.indexOf(this);
        if (index > -1) {
            shapes.splice(index, 1);
        }
        if (currentShape === this) {
            currentShape = null;
        }
    }
}

// Add delete functionality like in lineTool.js
function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'arrow') {
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
    if (e.key === 'Delete' && currentShape && currentShape.shapeName === 'arrow') {
        deleteCurrentShape();
    }
});

// Updated mouse event handlers with better selection detection
const handleMouseDown = (e) => {
    if (!isArrowToolActive && !isSelectionToolActive) return;

    const { x, y } = getSVGCoordsFromMouse(e);

    if (isArrowToolActive) {
        isDrawingArrow = true;
        currentArrow = new Arrow({ x, y }, { x, y }, {
            stroke: arrowStrokeColor,
            strokeWidth: arrowStrokeThickness,
            arrowOutlineStyle: arrowOutlineStyle, 
            arrowHeadStyle: arrowHeadStyle,
        });
        shapes.push(currentArrow);
        currentShape = currentArrow;
    } else if (isSelectionToolActive) {
        let clickedOnShape = false;
        let clickedOnAnchor = false;
        
        // --- IMPROVED: Better anchor and shape detection ---
        if (currentShape && currentShape.shapeName === 'arrow' && currentShape.isSelected) {
            // Check if clicking on an anchor first
            const anchorInfo = currentShape.isNearAnchor(x, y);
            if (anchorInfo && anchorInfo.type === 'anchor') {
                clickedOnAnchor = true;
                clickedOnShape = true; // Treat anchor click as shape click to prevent deselection
                // The anchor drag is handled by the anchor's event listener
            } else if (currentShape.contains(x, y)) {
                // Clicking on the arrow body (not anchor)
                isDragging = true;
                dragOldPosArrow = {
                    startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                    endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
                };
                startX = x;
                startY = y;
                clickedOnShape = true;
            }
        }

        // If not clicking on selected shape or anchor, check for other shapes
        if (!clickedOnShape) {
            let shapeToSelect = null;
            
            // Check all arrows for selection (most recently drawn first)
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape instanceof Arrow && shape.contains(x, y)) {
                    shapeToSelect = shape;
                    break;
                }
            }

            // Deselect current shape if selecting a different one
            if (currentShape && currentShape !== shapeToSelect) {
                currentShape.deselectArrow();
                currentShape = null;
            }

            if (shapeToSelect) {
                currentShape = shapeToSelect;
                currentShape.selectArrow();
                
                // Check if the click was on an anchor of the newly selected shape
                const anchorInfo = currentShape.isNearAnchor(x, y);
                if (anchorInfo && anchorInfo.type === 'anchor') {
                    clickedOnAnchor = true;
                } else {
                    // Start dragging the newly selected shape
                    isDragging = true;
                    dragOldPosArrow = {
                        startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
                        endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
                    };
                    startX = x;
                    startY = y;
                }
                clickedOnShape = true;
            }
        }

        // Only deselect if clicking outside any shape and not on anchor
        if (!clickedOnShape && !clickedOnAnchor && currentShape) {
            currentShape.deselectArrow();
            currentShape = null;
        }
    }
};

// Enhanced mouse move with better cursor feedback
const handleMouseMove = (e) => {
    const { x, y } = getSVGCoordsFromMouse(e);
    
    if (isDrawingArrow && currentArrow) {
        currentArrow.endPoint = { x, y };
        currentArrow.draw();
    } else if (isDragging && currentShape && currentShape.isSelected) {
        const dx = x - startX;
        const dy = y - startY;
        currentShape.move(dx, dy);
        startX = x;
        startY = y;
        currentShape.draw();
        svg.style.cursor = 'grabbing';
    } else if (isSelectionToolActive && currentShape && currentShape.isSelected) {
        // Provide visual feedback when hovering over anchors or the arrow
        const anchorInfo = currentShape.isNearAnchor(x, y);
        if (anchorInfo) {
            svg.style.cursor = 'grab';
        } else if (currentShape.contains(x, y)) {
            svg.style.cursor = 'move';
        } else {
            svg.style.cursor = 'default';
        }
    } else if (isSelectionToolActive) {
        // Check if hovering over any selectable arrow
        let hoveringOverArrow = false;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            if (shape instanceof Arrow && shape.contains(x, y)) {
                hoveringOverArrow = true;
                break;
            }
        }
        svg.style.cursor = hoveringOverArrow ? 'pointer' : 'default';
    }
};

const handleMouseUp = (e) => {
    if (isDrawingArrow && currentArrow) {
        // Check if arrow is too small
        const dx = currentArrow.endPoint.x - currentArrow.startPoint.x;
        const dy = currentArrow.endPoint.y - currentArrow.startPoint.y;
        const lengthSq = dx * dx + dy * dy;
        
        if (lengthSq < (5 / currentZoom) ** 2) {
            shapes.pop();
            if (currentArrow.group.parentNode) {
                currentArrow.group.parentNode.removeChild(currentArrow.group);
            }
            currentArrow = null;
            currentShape = null;
        } else {
            // Push create action for undo/redo
            pushCreateAction(currentArrow);
        }
        
        currentArrow = null;
    }
    
    if (isDragging && dragOldPosArrow && currentShape) {
        const newPos = {
            startPoint: { x: currentShape.startPoint.x, y: currentShape.startPoint.y },
            endPoint: { x: currentShape.endPoint.x, y: currentShape.endPoint.y }
        };
        const stateChanged = dragOldPosArrow.startPoint.x !== newPos.startPoint.x || 
                           dragOldPosArrow.startPoint.y !== newPos.startPoint.y ||
                           dragOldPosArrow.endPoint.x !== newPos.endPoint.x || 
                           dragOldPosArrow.endPoint.y !== newPos.endPoint.y;
        
        if (stateChanged) {
            pushTransformAction(currentShape, dragOldPosArrow, newPos);
        }
        dragOldPosArrow = null;
    }

    isDrawingArrow = false;
    isResizing = false;
    isDragging = false;
    activeAnchor = null;
    svg.style.cursor = 'default';
};

// Remove old event listeners and add new ones
svg.removeEventListener('mousedown', handleMouseDown);
document.removeEventListener('mousemove', handleMouseMove);
document.removeEventListener('mouseup', handleMouseUp);

svg.addEventListener('mousedown', handleMouseDown);
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseup', handleMouseUp);

// Updated style handlers with undo/redo support
const updateSelectedArrowStyle = (styleChanges) => {
    if (currentShape instanceof Arrow && currentShape.isSelected) {
        const oldOptions = {...currentShape.options, arrowOutlineStyle: currentShape.arrowOutlineStyle, arrowHeadStyle: currentShape.arrowHeadStyle};
        currentShape.updateStyle(styleChanges);
        pushOptionsChangeAction(currentShape, oldOptions);
    } else {
         if (styleChanges.stroke !== undefined) arrowStrokeColor = styleChanges.stroke;
         if (styleChanges.strokeWidth !== undefined) arrowStrokeThickness = styleChanges.strokeWidth;
         if (styleChanges.arrowOutlineStyle !== undefined) arrowOutlineStyle = styleChanges.arrowOutlineStyle;
         if (styleChanges.arrowHeadStyle !== undefined) arrowHeadStyle = styleChanges.arrowHeadStyle;
    }
};

arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newColor = span.getAttribute("data-id");
        updateSelectedArrowStyle({ stroke: newColor }); 
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newThickness = parseInt(span.getAttribute("data-id"));
        updateSelectedArrowStyle({ strokeWidth: newThickness });
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newStyle = span.getAttribute("data-id");
        updateSelectedArrowStyle({ arrowOutlineStyle: newStyle }); 
    });
});

arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const isCurved = span.getAttribute("data-id") === 'true';
        console.warn("Curved arrow style selection not implemented in draw logic.");
    });
});

arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        const newHeadStyle = span.getAttribute("data-id");
        updateSelectedArrowStyle({ arrowHeadStyle: newHeadStyle });
    });
});

// Add copy/paste functionality like in lineTool.js
function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneArrowData(arrow) {
    return {
        startPoint: { x: arrow.startPoint.x, y: arrow.startPoint.y },
        endPoint: { x: arrow.endPoint.x, y: arrow.endPoint.y },
        options: cloneOptions(arrow.options),
        arrowOutlineStyle: arrow.arrowOutlineStyle,
        arrowHeadStyle: arrow.arrowHeadStyle
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'arrow' && currentShape.isSelected) {
            copiedShapeData = cloneArrowData(currentShape);
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
            const newArrow = new Arrow(
                { x: copiedShapeData.startPoint.x + offset, y: copiedShapeData.startPoint.y + offset },
                { x: copiedShapeData.endPoint.x + offset, y: copiedShapeData.endPoint.y + offset },
                {
                    ...cloneOptions(copiedShapeData.options),
                    arrowOutlineStyle: copiedShapeData.arrowOutlineStyle,
                    arrowHeadStyle: copiedShapeData.arrowHeadStyle
                }
            );
            
            shapes.push(newArrow);
            newArrow.isSelected = true;
            currentShape = newArrow;
            newArrow.draw();
            pushCreateAction(newArrow);
        }
    }
});