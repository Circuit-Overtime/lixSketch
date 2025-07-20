// Multi-selection variables
let isMultiSelecting = false;
let multiSelectionStart = { x: 0, y: 0 };
let multiSelectionRect = null;
let isDraggingMultiSelection = false;
function getSVGCoordsFromMouse(e) {
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}

// Create multi-selection rectangle for visual feedback
function createMultiSelectionRect(startX, startY) {
    multiSelectionRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    multiSelectionRect.setAttribute('x', startX);
    multiSelectionRect.setAttribute('y', startY);
    multiSelectionRect.setAttribute('width', 0);
    multiSelectionRect.setAttribute('height', 0);
    multiSelectionRect.setAttribute('fill', 'rgba(91, 87, 209, 0.1)');
    multiSelectionRect.setAttribute('stroke', '#5B57D1');
    multiSelectionRect.setAttribute('stroke-width', 1);
    multiSelectionRect.setAttribute('stroke-dasharray', '4 2');
    multiSelectionRect.setAttribute('style', 'pointer-events: none;');
    svg.appendChild(multiSelectionRect);
}

// Update multi-selection rectangle
function updateMultiSelectionRect(currentX, currentY) {
    if (!multiSelectionRect) return;
    
    const x = Math.min(multiSelectionStart.x, currentX);
    const y = Math.min(multiSelectionStart.y, currentY);
    const width = Math.abs(currentX - multiSelectionStart.x);
    const height = Math.abs(currentY - multiSelectionStart.y);
    
    multiSelectionRect.setAttribute('x', x);
    multiSelectionRect.setAttribute('y', y);
    multiSelectionRect.setAttribute('width', width);
    multiSelectionRect.setAttribute('height', height);
}

// Remove multi-selection rectangle
function removeMultiSelectionRect() {
    if (multiSelectionRect && multiSelectionRect.parentNode) {
        multiSelectionRect.parentNode.removeChild(multiSelectionRect);
    }
    multiSelectionRect = null;
}

// Check if a shape intersects with selection rectangle
function isShapeInSelectionRect(shape, selectionBounds) {
    let shapeBounds;
    
    // Handle different shape types
    switch (shape.shapeName) {
        case 'rectangle':
            shapeBounds = {
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height
            };
            break;
        case 'circle':
            shapeBounds = {
                x: shape.x - shape.rx,
                y: shape.y - shape.ry,
                width: shape.rx * 2,
                height: shape.ry * 2
            };
            break;
        case 'line':
            shapeBounds = {
                x: Math.min(shape.startPoint.x, shape.endPoint.x),
                y: Math.min(shape.startPoint.y, shape.endPoint.y),
                width: Math.abs(shape.endPoint.x - shape.startPoint.x),
                height: Math.abs(shape.endPoint.y - shape.startPoint.y)
            };
            break;
        case 'arrow':
            const minX = Math.min(shape.startPoint.x, shape.endPoint.x);
            const minY = Math.min(shape.startPoint.y, shape.endPoint.y);
            const maxX = Math.max(shape.startPoint.x, shape.endPoint.x);
            const maxY = Math.max(shape.startPoint.y, shape.endPoint.y);
            shapeBounds = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
            break;
        case 'freehandStroke':
            shapeBounds = {
                x: shape.boundingBox.x,
                y: shape.boundingBox.y,
                width: shape.boundingBox.width,
                height: shape.boundingBox.height
            };
            break;
        case 'text':
            const textElement = shape.group ? shape.group.querySelector('text') : null;
            if (textElement) {
                const bbox = textElement.getBBox();
                const transform = shape.group.transform.baseVal.consolidate();
                const matrix = transform ? transform.matrix : { e: 0, f: 0 };
                shapeBounds = {
                    x: bbox.x + matrix.e,
                    y: bbox.y + matrix.f,
                    width: bbox.width,
                    height: bbox.height
                };
            } else {
                shapeBounds = { x: 0, y: 0, width: 0, height: 0 };
            }
            break;
        case 'image':
            if (shape.element) {
                shapeBounds = {
                    x: parseFloat(shape.element.getAttribute('x')),
                    y: parseFloat(shape.element.getAttribute('y')),
                    width: parseFloat(shape.element.getAttribute('width')),
                    height: parseFloat(shape.element.getAttribute('height'))
                };
            } else {
                shapeBounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
            }
            break;
        case 'frame':
            shapeBounds = {
                x: shape.x,
                y: shape.y,
                width: shape.width,
                height: shape.height
            };
            break;
        default:
            // Fallback for unknown shape types
            shapeBounds = {
                x: shape.x || 0,
                y: shape.y || 0,
                width: shape.width || 0,
                height: shape.height || 0
            };
    }
    
    // Check intersection
    return !(selectionBounds.x > shapeBounds.x + shapeBounds.width ||
             selectionBounds.x + selectionBounds.width < shapeBounds.x ||
             selectionBounds.y > shapeBounds.y + shapeBounds.height ||
             selectionBounds.y + selectionBounds.height < shapeBounds.y);
}

class MultiSelection {
    constructor() {
        this.selectedShapes = new Set();
        this.group = null;
        this.anchors = [];
        this.outline = null;
        this.rotationAnchor = null;
        this.rotationLine = null;
        this.selectionPadding = 12;
        this.bounds = null;
        this.initialPositions = new Map();
        
        // Interaction states
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizingAnchorIndex = null;
        this.dragStart = { x: 0, y: 0 };
        this.rotationCenter = { x: 0, y: 0 };
        this.startRotationMouseAngle = 0;
        this.initialRotation = 0;
    }

    addShape(shape) {
        this.selectedShapes.add(shape);
        shape.isSelected = true;
        this.updateControls();
    }

    removeShape(shape) {
        this.selectedShapes.delete(shape);
        shape.isSelected = false;
        if (this.selectedShapes.size === 0) {
            this.clearSelection();
        } else {
            this.updateControls();
        }
    }

    clearSelection() {
        this.selectedShapes.forEach(shape => {
            shape.isSelected = false;
            if (typeof shape.removeSelection === 'function') {
                shape.removeSelection();
            }
        });
        this.selectedShapes.clear();
        this.removeControls();
        if (typeof currentShape !== 'undefined') {
            currentShape = null;
        }
        if (typeof disableAllSideBars === 'function') {
            disableAllSideBars();
        }
    }

    selectShapesInRect(selectionBounds) {
        this.clearSelection();
        
        if (typeof shapes !== 'undefined') {
            shapes.forEach(shape => {
                if (isShapeInSelectionRect(shape, selectionBounds)) {
                    this.addShape(shape);
                }
            });
        }

        if (this.selectedShapes.size === 1) {
            if (typeof currentShape !== 'undefined') {
                currentShape = Array.from(this.selectedShapes)[0];
            }
        } else {
            if (typeof currentShape !== 'undefined') {
                currentShape = null;
            }
        }
    }

    getBounds() {
        if (this.selectedShapes.size === 0) return null;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        this.selectedShapes.forEach(shape => {
            const shapeBounds = this.getShapeBounds(shape);
            minX = Math.min(minX, shapeBounds.x);
            minY = Math.min(minY, shapeBounds.y);
            maxX = Math.max(maxX, shapeBounds.x + shapeBounds.width);
            maxY = Math.max(maxY, shapeBounds.y + shapeBounds.height);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    getShapeBounds(shape) {
        switch (shape.shapeName) {
            case 'rectangle':
            case 'frame':
                return {
                    x: shape.x,
                    y: shape.y,
                    width: shape.width,
                    height: shape.height
                };
            case 'circle':
                return {
                    x: shape.x - shape.rx,
                    y: shape.y - shape.ry,
                    width: shape.rx * 2,
                    height: shape.ry * 2
                };
            case 'line':
            case 'arrow':
                return {
                    x: Math.min(shape.startPoint.x, shape.endPoint.x),
                    y: Math.min(shape.startPoint.y, shape.endPoint.y),
                    width: Math.abs(shape.endPoint.x - shape.startPoint.x),
                    height: Math.abs(shape.endPoint.y - shape.startPoint.y)
                };
            case 'freehandStroke':
                return {
                    x: shape.boundingBox.x,
                    y: shape.boundingBox.y,
                    width: shape.boundingBox.width,
                    height: shape.boundingBox.height
                };
            case 'text':
                const textElement = shape.group ? shape.group.querySelector('text') : null;
                if (textElement) {
                    const bbox = textElement.getBBox();
                    const transform = shape.group.transform.baseVal.consolidate();
                    const matrix = transform ? transform.matrix : { e: 0, f: 0 };
                    return {
                        x: bbox.x + matrix.e,
                        y: bbox.y + matrix.f,
                        width: bbox.width,
                        height: bbox.height
                    };
                }
                return { x: 0, y: 0, width: 0, height: 0 };
            case 'image':
                if (shape.element) {
                    return {
                        x: parseFloat(shape.element.getAttribute('x')),
                        y: parseFloat(shape.element.getAttribute('y')),
                        width: parseFloat(shape.element.getAttribute('width')),
                        height: parseFloat(shape.element.getAttribute('height'))
                    };
                }
                return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
            default:
                return {
                    x: shape.x || 0,
                    y: shape.y || 0,
                    width: shape.width || 0,
                    height: shape.height || 0
                };
        }
    }

    updateControls() {
        this.removeControls();
        if (this.selectedShapes.size === 0) return;

        this.bounds = this.getBounds();
        if (!this.bounds) return;

        this.createControls();
    }

    createControls() {
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.group.setAttribute('id', 'multi-selection-controls');
        if (typeof svg !== 'undefined') {
            svg.appendChild(this.group);
        }

        const expandedX = this.bounds.x - this.selectionPadding;
        const expandedY = this.bounds.y - this.selectionPadding;
        const expandedWidth = this.bounds.width + 2 * this.selectionPadding;
        const expandedHeight = this.bounds.height + 2 * this.selectionPadding;

        this.createOutline(expandedX, expandedY, expandedWidth, expandedHeight);
        this.createResizeAnchors(expandedX, expandedY, expandedWidth, expandedHeight);
        this.createRotationAnchor(expandedX, expandedY, expandedWidth, expandedHeight);
    }

    createOutline(x, y, width, height) {
        const outlinePoints = [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height],
            [x, y]
        ];

        this.outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        this.outline.setAttribute('points', outlinePoints.map(p => p.join(',')).join(' '));
        this.outline.setAttribute('fill', 'none');
        this.outline.setAttribute('stroke', '#5B57D1');
        this.outline.setAttribute('stroke-width', 2);
        this.outline.setAttribute('stroke-dasharray', '8 4');
        this.outline.setAttribute('style', 'pointer-events: none;');
        this.group.appendChild(this.outline);
    }

    createResizeAnchors(x, y, width, height) {
        const anchorSize = 12;
        const anchorPositions = [
            { x: x, y: y, index: 0 }, // top-left
            { x: x + width, y: y, index: 1 }, // top-right
            { x: x, y: y + height, index: 2 }, // bottom-left
            { x: x + width, y: y + height, index: 3 }, // bottom-right
            { x: x + width / 2, y: y, index: 4 }, // top-center
            { x: x + width / 2, y: y + height, index: 5 }, // bottom-center
            { x: x, y: y + height / 2, index: 6 }, // left-center
            { x: x + width, y: y + height / 2, index: 7 } // right-center
        ];

        this.anchors = [];
        anchorPositions.forEach((pos) => {
            const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            anchor.setAttribute('x', pos.x - anchorSize / 2);
            anchor.setAttribute('y', pos.y - anchorSize / 2);
            anchor.setAttribute('width', anchorSize);
            anchor.setAttribute('height', anchorSize);
            anchor.setAttribute('class', 'multi-selection-anchor');
            anchor.setAttribute('data-index', pos.index);
            anchor.setAttribute('fill', '#121212');
            anchor.setAttribute('stroke', '#5B57D1');
            anchor.setAttribute('stroke-width', 2);
            anchor.setAttribute('style', 'pointer-events: all; cursor: pointer;');

            const cursors = ['nw-resize', 'ne-resize', 'sw-resize', 'se-resize', 'n-resize', 's-resize', 'w-resize', 'e-resize'];
            anchor.style.cursor = cursors[pos.index];

            anchor.addEventListener('mousedown', (e) => this.startResize(e, pos.index));
            
            this.group.appendChild(anchor);
            this.anchors.push(anchor);
        });
    }

    createRotationAnchor(x, y, width, height) {
        const rotationAnchorPos = { x: x + width / 2, y: y - 30 };
        
        this.rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
        this.rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
        this.rotationAnchor.setAttribute('r', 8);
        this.rotationAnchor.setAttribute('class', 'multi-selection-rotation-anchor');
        this.rotationAnchor.setAttribute('fill', '#121212');
        this.rotationAnchor.setAttribute('stroke', '#5B57D1');
        this.rotationAnchor.setAttribute('stroke-width', 2);
        this.rotationAnchor.setAttribute('style', 'pointer-events: all; cursor: grab;');

        this.rotationAnchor.addEventListener('mousedown', (e) => this.startRotation(e));

        // Rotation line
        this.rotationLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        this.rotationLine.setAttribute('x1', rotationAnchorPos.x);
        this.rotationLine.setAttribute('y1', rotationAnchorPos.y);
        this.rotationLine.setAttribute('x2', x + width / 2);
        this.rotationLine.setAttribute('y2', y);
        this.rotationLine.setAttribute('stroke', '#5B57D1');
        this.rotationLine.setAttribute('stroke-width', 1);
        this.rotationLine.setAttribute('stroke-dasharray', '3 3');
        this.rotationLine.setAttribute('style', 'pointer-events: none;');

        this.group.appendChild(this.rotationLine);
        this.group.appendChild(this.rotationAnchor);
    }

    removeControls() {
        if (this.group && this.group.parentNode) {
            this.group.parentNode.removeChild(this.group);
        }
        this.group = null;
        this.anchors = [];
        this.outline = null;
        this.rotationAnchor = null;
        this.rotationLine = null;
    }

    isPointInBounds(x, y) {
        if (!this.bounds) return false;
        
        const padding = this.selectionPadding;
        return x >= this.bounds.x - padding && x <= this.bounds.x + this.bounds.width + padding &&
               y >= this.bounds.y - padding && y <= this.bounds.y + this.bounds.height + padding;
    }

    move(dx, dy) {
        this.selectedShapes.forEach(shape => {
            switch (shape.shapeName) {
                case 'rectangle':
                case 'circle':
                case 'freehandStroke':
                case 'frame':
                    if (typeof shape.move === 'function') {
                        shape.move(dx, dy);
                        shape.draw();
                    }
                    break;
                case 'line':
                case 'arrow':
                    if (typeof shape.move === 'function') {
                        shape.move(dx, dy);
                        shape.draw();
                    }
                    break;
                case 'text':
                case 'image':
                    if (typeof shape.move === 'function') {
                        shape.move(dx, dy);
                    }
                    break;
            }

            if (typeof shape.updateAttachedArrows === 'function') {
                shape.updateAttachedArrows();
            }
        });

        this.updateControls();
    }

    startRotation(e) {
        e.stopPropagation();
        e.preventDefault();

        this.isRotating = true;
        this.rotationCenter = {
            x: this.bounds.x + this.bounds.width / 2,
            y: this.bounds.y + this.bounds.height / 2
        };

        const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
        this.startRotationMouseAngle = Math.atan2(mouseY - this.rotationCenter.y, mouseX - this.rotationCenter.x) * 180 / Math.PI;

        // Store initial positions for all shapes
        this.storeInitialPositions();

        const onMouseMove = (event) => {
            if (this.isRotating) {
                this.handleRotation(event);
            }
        };

        const onMouseUp = () => {
            this.isRotating = false;
            this.initialPositions.clear();
            if (typeof svg !== 'undefined') {
                svg.removeEventListener('mousemove', onMouseMove);
                svg.removeEventListener('mouseup', onMouseUp);
                svg.style.cursor = 'default';
            }
        };

        if (typeof svg !== 'undefined') {
            svg.addEventListener('mousemove', onMouseMove);
            svg.addEventListener('mouseup', onMouseUp);
            svg.style.cursor = 'grabbing';
        }
    }

    storeInitialPositions() {
        this.initialPositions.clear();
        
        this.selectedShapes.forEach(shape => {
            let shapeData;
            switch (shape.shapeName) {
                case 'rectangle':
                case 'circle':
                case 'frame':
                    shapeData = {
                        x: shape.x,
                        y: shape.y,
                        width: shape.width || 0,
                        height: shape.height || 0,
                        rx: shape.rx || 0,
                        ry: shape.ry || 0,
                        rotation: shape.rotation || 0,
                        relativeX: shape.x - this.rotationCenter.x,
                        relativeY: shape.y - this.rotationCenter.y
                    };
                    break;
                case 'line':
                case 'arrow':
                    shapeData = {
                        startPoint: { ...shape.startPoint },
                        endPoint: { ...shape.endPoint },
                        relativeStartX: shape.startPoint.x - this.rotationCenter.x,
                        relativeStartY: shape.startPoint.y - this.rotationCenter.y,
                        relativeEndX: shape.endPoint.x - this.rotationCenter.x,
                        relativeEndY: shape.endPoint.y - this.rotationCenter.y
                    };
                    break;
                case 'freehandStroke':
                    shapeData = {
                        x: shape.boundingBox.x,
                        y: shape.boundingBox.y,
                        width: shape.boundingBox.width,
                        height: shape.boundingBox.height,
                        points: [...shape.points],
                        relativePoints: shape.points.map(point => ({
                            x: point.x - this.rotationCenter.x,
                            y: point.y - this.rotationCenter.y
                        }))
                    };
                    break;
                default:
                    shapeData = {
                        x: shape.x || 0,
                        y: shape.y || 0,
                        width: shape.width || 0,
                        height: shape.height || 0,
                        rotation: shape.rotation || 0,
                        relativeX: (shape.x || 0) - this.rotationCenter.x,
                        relativeY: (shape.y || 0) - this.rotationCenter.y
                    };
            }
            this.initialPositions.set(shape, shapeData);
        });
    }

    handleRotation(e) {
        const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
        const currentMouseAngle = Math.atan2(mouseY - this.rotationCenter.y, mouseX - this.rotationCenter.x) * 180 / Math.PI;
        const angleDiff = currentMouseAngle - this.startRotationMouseAngle;

        // Convert angle difference to radians
        const angleRad = angleDiff * Math.PI / 180;
        const cosAngle = Math.cos(angleRad);
        const sinAngle = Math.sin(angleRad);

        console.log(`Rotating multi-selection by ${angleDiff} degrees around center (${this.rotationCenter.x}, ${this.rotationCenter.y})`);

        // Apply rotation to all selected shapes
        this.selectedShapes.forEach(shape => {
            const initialData = this.initialPositions.get(shape);
            if (!initialData) return;

            switch (shape.shapeName) {
                case 'rectangle':
                case 'circle':
                case 'frame':
                    // Rotate position around center
                    const newX = this.rotationCenter.x + (initialData.relativeX * cosAngle - initialData.relativeY * sinAngle);
                    const newY = this.rotationCenter.y + (initialData.relativeX * sinAngle + initialData.relativeY * cosAngle);
                    
                    shape.x = newX;
                    shape.y = newY;
                    
                    // Add rotation to existing rotation
                    if (typeof shape.rotate === 'function') {
                        shape.rotate(initialData.rotation + angleDiff);
                    }
                    
                    shape.draw();
                    break;

                case 'line':
                case 'arrow':
                    // Rotate start point
                    const newStartX = this.rotationCenter.x + (initialData.relativeStartX * cosAngle - initialData.relativeStartY * sinAngle);
                    const newStartY = this.rotationCenter.y + (initialData.relativeStartX * sinAngle + initialData.relativeStartY * cosAngle);
                    
                    // Rotate end point
                    const newEndX = this.rotationCenter.x + (initialData.relativeEndX * cosAngle - initialData.relativeEndY * sinAngle);
                    const newEndY = this.rotationCenter.y + (initialData.relativeEndX * sinAngle + initialData.relativeEndY * cosAngle);
                    
                    shape.startPoint.x = newStartX;
                    shape.startPoint.y = newStartY;
                    shape.endPoint.x = newEndX;
                    shape.endPoint.y = newEndY;
                    
                    if (shape.shapeName === 'arrow' && shape.arrowCurved) {
                        if (typeof shape.initializeCurveControlPoints === 'function') {
                            shape.initializeCurveControlPoints();
                        }
                    }
                    
                    shape.draw();
                    break;

                case 'freehandStroke':
                    // Rotate all points
                    shape.points = initialData.relativePoints.map(relPoint => ({
                        x: this.rotationCenter.x + (relPoint.x * cosAngle - relPoint.y * sinAngle),
                        y: this.rotationCenter.y + (relPoint.x * sinAngle + relPoint.y * cosAngle)
                    }));
                    
                    // Update bounding box
                    if (typeof shape.updateBoundingBox === 'function') {
                        shape.updateBoundingBox();
                    }
                    shape.draw();
                    break;

                default:
                    // Handle other shape types
                    const newXDefault = this.rotationCenter.x + (initialData.relativeX * cosAngle - initialData.relativeY * sinAngle);
                    const newYDefault = this.rotationCenter.y + (initialData.relativeX * sinAngle + initialData.relativeY * cosAngle);
                    
                    shape.x = newXDefault;
                    shape.y = newYDefault;
                    
                    if (typeof shape.rotate === 'function') {
                        shape.rotate(initialData.rotation + angleDiff);
                    }
                    
                    if (typeof shape.draw === 'function') {
                        shape.draw();
                    }
                    break;
            }

            // Update attached arrows
            if (typeof shape.updateAttachedArrows === 'function') {
                shape.updateAttachedArrows();
            }
        });

        this.updateControls();
    }

    startResize(e, anchorIndex) {
        e.stopPropagation();
        e.preventDefault();
        
        this.isResizing = true;
        this.resizingAnchorIndex = anchorIndex;
        
        // Store initial positions for all shapes
        this.initialPositions.clear();
        const initialBounds = this.getBounds();
        
        this.selectedShapes.forEach(shape => {
            let shapeData;
            switch (shape.shapeName) {
                case 'rectangle':
                    shapeData = {
                        x: shape.x,
                        y: shape.y,
                        width: shape.width,
                        height: shape.height,
                        rotation: shape.rotation
                    };
                    break;
                case 'circle':
                    shapeData = {
                        x: shape.x,
                        y: shape.y,
                        rx: shape.rx,
                        ry: shape.ry,
                        rotation: shape.rotation
                    };
                    break;
                case 'line':
                case 'arrow':
                    shapeData = {
                        startPoint: { ...shape.startPoint },
                        endPoint: { ...shape.endPoint }
                    };
                    break;
                default:
                    shapeData = {
                        x: shape.x || 0,
                        y: shape.y || 0,
                        width: shape.width || 0,
                        height: shape.height || 0
                    };
            }
            this.initialPositions.set(shape, shapeData);
        });
        
        this.initialPositions.set('bounds', initialBounds);
        
        const onMouseMove = (event) => {
            if (this.isResizing) {
                this.handleResize(event);
            }
        };
        
        const onMouseUp = () => {
            this.isResizing = false;
            this.resizingAnchorIndex = null;
            this.initialPositions.clear();
            if (typeof svg !== 'undefined') {
                svg.removeEventListener('mousemove', onMouseMove);
                svg.removeEventListener('mouseup', onMouseUp);
                svg.style.cursor = 'default';
            }
        };
        
        if (typeof svg !== 'undefined') {
            svg.addEventListener('mousemove', onMouseMove);
            svg.addEventListener('mouseup', onMouseUp);
        }
    }

    handleResize(e) {
        const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
        const initialBounds = this.initialPositions.get('bounds');
        if (!initialBounds) return;
        
        // Calculate scale factors based on anchor and mouse position
        let scaleX = 1, scaleY = 1;
        let newBounds = { ...initialBounds };
        
        switch (this.resizingAnchorIndex) {
            case 0: // top-left
                scaleX = (initialBounds.x + initialBounds.width - mouseX) / initialBounds.width;
                scaleY = (initialBounds.y + initialBounds.height - mouseY) / initialBounds.height;
                newBounds.x = mouseX;
                newBounds.y = mouseY;
                newBounds.width = initialBounds.x + initialBounds.width - mouseX;
                newBounds.height = initialBounds.y + initialBounds.height - mouseY;
                break;
            case 1: // top-right
                scaleX = (mouseX - initialBounds.x) / initialBounds.width;
                scaleY = (initialBounds.y + initialBounds.height - mouseY) / initialBounds.height;
                newBounds.y = mouseY;
                newBounds.width = mouseX - initialBounds.x;
                newBounds.height = initialBounds.y + initialBounds.height - mouseY;
                break;
            case 2: // bottom-left
                scaleX = (initialBounds.x + initialBounds.width - mouseX) / initialBounds.width;
                scaleY = (mouseY - initialBounds.y) / initialBounds.height;
                newBounds.x = mouseX;
                newBounds.width = initialBounds.x + initialBounds.width - mouseX;
                newBounds.height = mouseY - initialBounds.y;
                break;
            case 3: // bottom-right
                scaleX = (mouseX - initialBounds.x) / initialBounds.width;
                scaleY = (mouseY - initialBounds.y) / initialBounds.height;
                newBounds.width = mouseX - initialBounds.x;
                newBounds.height = mouseY - initialBounds.y;
                break;
            case 4: // top-center
                scaleY = (initialBounds.y + initialBounds.height - mouseY) / initialBounds.height;
                newBounds.y = mouseY;
                newBounds.height = initialBounds.y + initialBounds.height - mouseY;
                break;
            case 5: // bottom-center
                scaleY = (mouseY - initialBounds.y) / initialBounds.height;
                newBounds.height = mouseY - initialBounds.y;
                break;
            case 6: // left-center
                scaleX = (initialBounds.x + initialBounds.width - mouseX) / initialBounds.width;
                newBounds.x = mouseX;
                newBounds.width = initialBounds.x + initialBounds.width - mouseX;
                break;
            case 7: // right-center
                scaleX = (mouseX - initialBounds.x) / initialBounds.width;
                newBounds.width = mouseX - initialBounds.x;
                break;
        }
        
        // Ensure minimum scale
        scaleX = Math.max(0.1, Math.abs(scaleX));
        scaleY = Math.max(0.1, Math.abs(scaleY));
        
        // Apply transformations to all selected shapes
        this.selectedShapes.forEach(shape => {
            const initialData = this.initialPositions.get(shape);
            if (!initialData) return;
            
            switch (shape.shapeName) {
                case 'rectangle':
                    const relX = (initialData.x - initialBounds.x) / initialBounds.width;
                    const relY = (initialData.y - initialBounds.y) / initialBounds.height;
                    const relW = initialData.width / initialBounds.width;
                    const relH = initialData.height / initialBounds.height;
                    
                    shape.x = newBounds.x + relX * newBounds.width;
                    shape.y = newBounds.y + relY * newBounds.height;
                    shape.width = relW * newBounds.width;
                    shape.height = relH * newBounds.height;
                    shape.draw();
                    break;
                    
                case 'circle':
                    const relXCircle = (initialData.x - initialBounds.x) / initialBounds.width;
                    const relYCircle = (initialData.y - initialBounds.y) / initialBounds.height;
                    
                    shape.x = newBounds.x + relXCircle * newBounds.width;
                    shape.y = newBounds.y + relYCircle * newBounds.height;
                    shape.rx = initialData.rx * scaleX;
                    shape.ry = initialData.ry * scaleY;
                    shape.draw();
                    break;
                    
                case 'line':
                case 'arrow':
                    const relStartX = (initialData.startPoint.x - initialBounds.x) / initialBounds.width;
                    const relStartY = (initialData.startPoint.y - initialBounds.y) / initialBounds.height;
                    const relEndX = (initialData.endPoint.x - initialBounds.x) / initialBounds.width;
                    const relEndY = (initialData.endPoint.y - initialBounds.y) / initialBounds.height;
                    
                    shape.startPoint.x = newBounds.x + relStartX * newBounds.width;
                    shape.startPoint.y = newBounds.y + relStartY * newBounds.height;
                    shape.endPoint.x = newBounds.x + relEndX * newBounds.width;
                    shape.endPoint.y = newBounds.y + relEndY * newBounds.height;
                    
                    if (shape.shapeName === 'arrow' && shape.arrowCurved) {
                        if (typeof shape.initializeCurveControlPoints === 'function') {
                            shape.initializeCurveControlPoints();
                        }
                    }
                    shape.draw();
                    break;
                    
                default:
                    const relXDefault = (initialData.x - initialBounds.x) / initialBounds.width;
                    const relYDefault = (initialData.y - initialBounds.y) / initialBounds.height;
                    const relWDefault = initialData.width / initialBounds.width;
                    const relHDefault = initialData.height / initialBounds.height;
                    
                    shape.x = newBounds.x + relXDefault * newBounds.width;
                    shape.y = newBounds.y + relYDefault * newBounds.height;
                    if (shape.width !== undefined) shape.width = relWDefault * newBounds.width;
                    if (shape.height !== undefined) shape.height = relHDefault * newBounds.height;
                    
                    if (typeof shape.draw === 'function') {
                        shape.draw();
                    }
            }
            
            if (typeof shape.updateAttachedArrows === 'function') {
                shape.updateAttachedArrows();
            }
        });
        
        this.updateControls();
    }

    startDrag(e) {
        this.isDragging = true;
        isDraggingMultiSelection = true;
        const { x, y } = getSVGCoordsFromMouse(e);
        this.dragStart = { x, y };
        
        // Store initial positions for undo
        this.initialPositions.clear();
        this.selectedShapes.forEach(shape => {
            let shapeData;
            switch (shape.shapeName) {
                case 'rectangle':
                    shapeData = {
                        x: shape.x,
                        y: shape.y,
                        width: shape.width,
                        height: shape.height,
                        rotation: shape.rotation
                    };
                    break;
                case 'circle':
                    shapeData = {
                        x: shape.x,
                        y: shape.y,
                        rx: shape.rx,
                        ry: shape.ry,
                        rotation: shape.rotation
                    };
                    break;
                case 'line':
                case 'arrow':
                    shapeData = {
                        startPoint: { ...shape.startPoint },
                        endPoint: { ...shape.endPoint }
                    };
                    break;
                default:
                    shapeData = {
                        x: shape.x || 0,
                        y: shape.y || 0,
                        width: shape.width || 0,
                        height: shape.height || 0,
                        rotation: shape.rotation || 0
                    };
            }
            this.initialPositions.set(shape, shapeData);
        });
        
        if (typeof svg !== 'undefined') {
            svg.style.cursor = 'move';
        }
    }

    handleDrag(e) {
        if (!this.isDragging) return;
        isDraggingMultiSelection = true;
        const { x, y } = getSVGCoordsFromMouse(e);
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        
        this.move(dx, dy);
        
        this.dragStart = { x, y };
    }

    endDrag() {
        if (!this.isDragging) return;
        isDraggingMultiSelection = false;
        this.isDragging = false;
        this.initialPositions.clear();
        if (typeof svg !== 'undefined') {
            svg.style.cursor = 'default';
        }
    }
}

// Create global multi-selection instance
const multiSelection = new MultiSelection();

// Update the existing functions to use the new class
function selectShapesInRect(selectionBounds) {
    multiSelection.selectShapesInRect(selectionBounds);
}

function clearAllSelections() {
    multiSelection.clearSelection();
}

function getMultiSelectionBounds() {
    return multiSelection.getBounds();
}

function createMultiSelectionControls() {
    multiSelection.updateControls();
}

function removeMultiSelectionControls() {
    multiSelection.removeControls();
}

function isPointInMultiSelection(x, y) {
    return multiSelection.isPointInBounds(x, y);
}

function moveSelectedShapes(dx, dy) {
    multiSelection.move(dx, dy);
}

// Update the mouse handlers to use the multi-selection class
function handleMultiSelectionMouseDown(e) {
    const { x, y } = getSVGCoordsFromMouse(e);
    
    // Check if clicking on multi-selection area or anchors
    if (multiSelection.selectedShapes.size > 1) {
        // Check if clicking on resize anchor
        const anchor = e.target.closest('.multi-selection-anchor');
        if (anchor) {
            const anchorIndex = parseInt(anchor.getAttribute('data-index'));
            multiSelection.startResize(e, anchorIndex);
            return true;
        }
        
        // Check if clicking on rotation anchor
        if (e.target.closest('.multi-selection-rotation-anchor')) {
            multiSelection.startRotation(e);
            return true;
        }
        
        // Check if clicking within multi-selection bounds for dragging
        if (multiSelection.isPointInBounds(x, y)) {
            multiSelection.startDrag(e);
            return true;
        }
    }
    
    // Start new multi-selection
    multiSelectionStart = { x, y };
    isMultiSelecting = true;
    createMultiSelectionRect(x, y);
    
    // Clear existing selections
    clearAllSelections();
    
    return true;
}

function handleMultiSelectionMouseMove(e) {
    const { x, y } = getSVGCoordsFromMouse(e);
    
    if (multiSelection.isDragging) {
        multiSelection.handleDrag(e);
        return true;
    }
    
    if (multiSelection.isResizing) {
        multiSelection.handleResize(e);
        return true;
    }
    
    if (multiSelection.isRotating) {
        multiSelection.handleRotation(e);
        return true;
    }
    
    if (isMultiSelecting) {
        updateMultiSelectionRect(x, y);
        return true;
    }
    
    // Update cursor for multi-selection area
    if (multiSelection.selectedShapes.size > 1 && multiSelection.isPointInBounds(x, y)) {
        if (typeof svg !== 'undefined') {
            svg.style.cursor = 'move';
        }
        return true;
    }
    
    return false;
}

function handleMultiSelectionMouseUp(e) {
    if (multiSelection.isDragging) {
        multiSelection.endDrag();
        return true;
    }
    
    if (isMultiSelecting) {
        const { x, y } = getSVGCoordsFromMouse(e);
        
        // Calculate selection bounds
        const selectionBounds = {
            x: Math.min(multiSelectionStart.x, x),
            y: Math.min(multiSelectionStart.y, y),
            width: Math.abs(x - multiSelectionStart.x),
            height: Math.abs(y - multiSelectionStart.y)
        };
        
        // Only select if there's a meaningful selection area
        if (selectionBounds.width > 5 && selectionBounds.height > 5) {
            multiSelection.selectShapesInRect(selectionBounds);
        }
        
        removeMultiSelectionRect();
        isMultiSelecting = false;
        return true;
    }
    
    return false;
}

// Export the updated functions and the multi-selection instance
export {
    handleMultiSelectionMouseDown,
    handleMultiSelectionMouseMove,
    handleMultiSelectionMouseUp,
    clearAllSelections,
    selectShapesInRect,
    createMultiSelectionControls,
    removeMultiSelectionControls,
    isPointInMultiSelection,
    moveSelectedShapes,
    multiSelection,
    isDraggingMultiSelection,
    isMultiSelecting
    
};