// Multi-selection variables
let isMultiSelecting = false;
let multiSelectionStart = { x: 0, y: 0 };
let multiSelectionRect = null;
let selectedShapes = new Set();
let multiSelectionGroup = null;
let multiSelectionAnchors = [];
let multiSelectionOutline = null;
let multiSelectionRotationAnchor = null;

// Dragging multi-selection
let isDraggingMultiSelection = false;
let isResizingMultiSelection = false;
let isRotatingMultiSelection = false;
let multiSelectionDragStart = { x: 0, y: 0 };
let multiSelectionInitialPositions = new Map();
let resizingAnchorIndexMulti = null;
let startRotationMouseAngleMulti = 0;
let startShapeRotationMulti = 0;

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

    function selectShapesInRect(selectionBounds) {
    // Clear previous selections
    clearAllSelections();
    selectedShapes.clear();
    
    // Find shapes within selection
    shapes.forEach(shape => {
        if (isShapeInSelectionRect(shape, selectionBounds)) {
            selectedShapes.add(shape);
            shape.isSelected = true;
            
            // NO INDIVIDUAL ANCHORS - NEVER add anchors to individual shapes in multi-selection
            // Just mark as selected, no visual indicators on individual shapes
        }
    });
    
    // Create overall selection controls ONLY - whether single or multiple shapes
    if (selectedShapes.size >= 1) {
        createMultiSelectionControls();
        
        // Set currentShape for single selection compatibility
        if (selectedShapes.size === 1) {
            currentShape = Array.from(selectedShapes)[0];
        } else {
            currentShape = null; // Multiple selection, no single currentShape
        }
    }
}

// Clear all shape selections
function clearAllSelections() {
    shapes.forEach(shape => {
        if (shape.isSelected) {
            shape.isSelected = false;
            // Remove individual shape selections
            switch (shape.shapeName) {
                case 'rectangle':
                case 'circle':
                case 'line':
                case 'arrow':
                case 'freehandStroke':
                    if (typeof shape.removeSelection === 'function') {
                        shape.removeSelection();
                    }
                    break;
                case 'text':
                    if (typeof deselectElement === 'function') {
                        deselectElement();
                    }
                    break;
                case 'image':
                    if (typeof removeSelectionOutline === 'function') {
                        removeSelectionOutline();
                    }
                    break;
                case 'frame':
                    if (typeof shape.removeSelection === 'function') {
                        shape.removeSelection();
                    }
                    break;
            }
        }
    });
    removeMultiSelectionControls();
    selectedShapes.clear();
    currentShape = null;
    disableAllSideBars();
}

// Get bounds of all selected shapes
function getMultiSelectionBounds() {
    if (selectedShapes.size === 0) return null;
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    selectedShapes.forEach(shape => {
        let shapeBounds;
        
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
                const minX_arrow = Math.min(shape.startPoint.x, shape.endPoint.x);
                const minY_arrow = Math.min(shape.startPoint.y, shape.endPoint.y);
                const maxX_arrow = Math.max(shape.startPoint.x, shape.endPoint.x);
                const maxY_arrow = Math.max(shape.startPoint.y, shape.endPoint.y);
                shapeBounds = {
                    x: minX_arrow,
                    y: minY_arrow,
                    width: maxX_arrow - minX_arrow,
                    height: maxY_arrow - minY_arrow
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
                shapeBounds = {
                    x: shape.x || 0,
                    y: shape.y || 0,
                    width: shape.width || 0,
                    height: shape.height || 0
                };
        }
        
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

// Create multi-selection controls (outline and anchors)
function createMultiSelectionControls() {
    removeMultiSelectionControls();
    
    const bounds = getMultiSelectionBounds();
    if (!bounds) return;
    
    // Create group for multi-selection controls
    multiSelectionGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    multiSelectionGroup.setAttribute('id', 'multi-selection-controls');
    svg.appendChild(multiSelectionGroup);
    
    const selectionPadding = 12;
    const expandedX = bounds.x - selectionPadding;
    const expandedY = bounds.y - selectionPadding;
    const expandedWidth = bounds.width + 2 * selectionPadding;
    const expandedHeight = bounds.height + 2 * selectionPadding;
    
    // Create outline
    const outlinePoints = [
        [expandedX, expandedY],
        [expandedX + expandedWidth, expandedY],
        [expandedX + expandedWidth, expandedY + expandedHeight],
        [expandedX, expandedY + expandedHeight],
        [expandedX, expandedY]
    ];
    
    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    multiSelectionOutline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    multiSelectionOutline.setAttribute('points', pointsAttr);
    multiSelectionOutline.setAttribute('fill', 'none');
    multiSelectionOutline.setAttribute('stroke', '#5B57D1');
    multiSelectionOutline.setAttribute('stroke-width', 2);
    multiSelectionOutline.setAttribute('stroke-dasharray', '8 4');
    multiSelectionOutline.setAttribute('style', 'pointer-events: none;');
    multiSelectionGroup.appendChild(multiSelectionOutline);
    
    // Create resize anchors for multi-selection (8 anchors)
    const anchorSize = 12;
    const anchorPositions = [
        { x: expandedX, y: expandedY, index: 0 }, // top-left
        { x: expandedX + expandedWidth, y: expandedY, index: 1 }, // top-right
        { x: expandedX, y: expandedY + expandedHeight, index: 2 }, // bottom-left
        { x: expandedX + expandedWidth, y: expandedY + expandedHeight, index: 3 }, // bottom-right
        { x: expandedX + expandedWidth / 2, y: expandedY, index: 4 }, // top-center
        { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight, index: 5 }, // bottom-center
        { x: expandedX, y: expandedY + expandedHeight / 2, index: 6 }, // left-center
        { x: expandedX + expandedWidth, y: expandedY + expandedHeight / 2, index: 7 } // right-center
    ];
    
    multiSelectionAnchors = [];
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
        
        // Set appropriate cursor for each anchor
        const cursors = ['nw-resize', 'ne-resize', 'sw-resize', 'se-resize', 'n-resize', 's-resize', 'w-resize', 'e-resize'];
        anchor.style.cursor = cursors[pos.index];
        
        anchor.addEventListener('mousedown', (e) => startMultiSelectionResize(e, pos.index));
        
        multiSelectionGroup.appendChild(anchor);
        multiSelectionAnchors.push(anchor);
    });
    
    // Create rotation anchor
    const rotationAnchorPos = { x: expandedX + expandedWidth / 2, y: expandedY - 30 };
    multiSelectionRotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    multiSelectionRotationAnchor.setAttribute('cx', rotationAnchorPos.x);
    multiSelectionRotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    multiSelectionRotationAnchor.setAttribute('r', 8);
    multiSelectionRotationAnchor.setAttribute('class', 'multi-selection-rotation-anchor');
    multiSelectionRotationAnchor.setAttribute('fill', '#121212');
    multiSelectionRotationAnchor.setAttribute('stroke', '#5B57D1');
    multiSelectionRotationAnchor.setAttribute('stroke-width', 2);
    multiSelectionRotationAnchor.setAttribute('style', 'pointer-events: all; cursor: grab;');
    
    multiSelectionRotationAnchor.addEventListener('mousedown', startMultiSelectionRotation);
    
    // Add rotation line
    const rotationLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    rotationLine.setAttribute('x1', rotationAnchorPos.x);
    rotationLine.setAttribute('y1', rotationAnchorPos.y);
    rotationLine.setAttribute('x2', expandedX + expandedWidth / 2);
    rotationLine.setAttribute('y2', expandedY);
    rotationLine.setAttribute('stroke', '#5B57D1');
    rotationLine.setAttribute('stroke-width', 1);
    rotationLine.setAttribute('stroke-dasharray', '3 3');
    rotationLine.setAttribute('style', 'pointer-events: none;');
    
    multiSelectionGroup.appendChild(rotationLine);
    multiSelectionGroup.appendChild(multiSelectionRotationAnchor);
}

// Remove multi-selection controls
function removeMultiSelectionControls() {
    if (multiSelectionGroup && multiSelectionGroup.parentNode) {
        multiSelectionGroup.parentNode.removeChild(multiSelectionGroup);
    }
    multiSelectionGroup = null;
    multiSelectionAnchors = [];
    multiSelectionOutline = null;
    multiSelectionRotationAnchor = null;
}

// Check if point is inside multi-selection bounds
function isPointInMultiSelection(x, y) {
    const bounds = getMultiSelectionBounds();
    if (!bounds) return false;
    
    const padding = 12;
    return x >= bounds.x - padding && x <= bounds.x + bounds.width + padding &&
           y >= bounds.y - padding && y <= bounds.y + bounds.height + padding;
}

// Move all selected shapes
function moveSelectedShapes(dx, dy) {
    selectedShapes.forEach(shape => {
        switch (shape.shapeName) {
            case 'rectangle':
            case 'circle':
            case 'freehandStroke':
            case 'frame':
                shape.move(dx, dy);
                shape.removeSelection()
                shape.draw();
                break;
            case 'line':
            case 'arrow':
                shape.move(dx, dy);
                shape.removeSelection()
                shape.draw();
                break;
            case 'text':
                if (shape.move) {
                    shape.removeSelection()
                    shape.move(dx, dy);
                }
                break;
            case 'image':
                if (shape.move) {
                    shape.removeSelection()
                    shape.move(dx, dy);
                }
                break;
        }
        
        // Update attached arrows if the shape has them
        if (typeof shape.updateAttachedArrows === 'function') {
            shape.updateAttachedArrows();
        }
    });
    
    // Update multi-selection controls
    if (selectedShapes.size > 1) {
        createMultiSelectionControls();
    }
}

// Start multi-selection resize
function startMultiSelectionResize(e, anchorIndex) {
    e.stopPropagation();
    e.preventDefault();
    
    isResizingMultiSelection = true;
    resizingAnchorIndexMulti = anchorIndex;
    
    // Store initial positions for all shapes
    multiSelectionInitialPositions.clear();
    const initialBounds = getMultiSelectionBounds();
    
    selectedShapes.forEach(shape => {
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
        multiSelectionInitialPositions.set(shape, shapeData);
    });
    
    // Store initial bounds
    multiSelectionInitialPositions.set('bounds', initialBounds);
    
    const onMouseMove = (event) => {
        if (isResizingMultiSelection) {
            handleMultiSelectionResize(event);
        }
    };
    
    const onMouseUp = () => {
        isResizingMultiSelection = false;
        resizingAnchorIndexMulti = null;
        multiSelectionInitialPositions.clear();
        svg.removeEventListener('mousemove', onMouseMove);
        svg.removeEventListener('mouseup', onMouseUp);
        svg.style.cursor = 'default';
    };
    
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
}

// Handle multi-selection resize
function handleMultiSelectionResize(e) {
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
    const initialBounds = multiSelectionInitialPositions.get('bounds');
    if (!initialBounds) return;
    
    // Calculate scale factors based on anchor and mouse position
    let scaleX = 1, scaleY = 1;
    let newBounds = { ...initialBounds };
    
    switch (resizingAnchorIndexMulti) {
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
    selectedShapes.forEach(shape => {
        const initialData = multiSelectionInitialPositions.get(shape);
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
                    shape.initializeCurveControlPoints();
                }
                shape.draw();
                break;
                
            default:
                // Handle other shape types (freehandStroke, text, image, frame)
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
        
        // Update attached arrows
        if (typeof shape.updateAttachedArrows === 'function') {
            shape.updateAttachedArrows();
        }
    });
    
    // Update multi-selection controls
    createMultiSelectionControls();
}

function startMultiSelectionRotation(e) {
    e.stopPropagation();
    e.preventDefault();
    
    isRotatingMultiSelection = true;
    
    const bounds = getMultiSelectionBounds();
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
    startRotationMouseAngleMulti = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
    
    // Store initial positions AND rotations for all shapes
    multiSelectionInitialPositions.clear();
    selectedShapes.forEach(shape => {
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
                    rotation: shape.rotation || 0, // Store current rotation
                    // Store relative position from center
                    relativeX: shape.x - centerX,
                    relativeY: shape.y - centerY
                };
                break;
            case 'line':
            case 'arrow':
                shapeData = {
                    startPoint: { ...shape.startPoint },
                    endPoint: { ...shape.endPoint },
                    // Store relative positions from center
                    relativeStartX: shape.startPoint.x - centerX,
                    relativeStartY: shape.startPoint.y - centerY,
                    relativeEndX: shape.endPoint.x - centerX,
                    relativeEndY: shape.endPoint.y - centerY
                };
                break;
            case 'freehandStroke':
                shapeData = {
                    x: shape.boundingBox.x,
                    y: shape.boundingBox.y,
                    width: shape.boundingBox.width,
                    height: shape.boundingBox.height,
                    points: [...shape.points], // Store original points
                    // Store relative points from center
                    relativePoints: shape.points.map(point => ({
                        x: point.x - centerX,
                        y: point.y - centerY
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
                    relativeX: (shape.x || 0) - centerX,
                    relativeY: (shape.y || 0) - centerY
                };
        }
        multiSelectionInitialPositions.set(shape, shapeData);
    });
    
    multiSelectionInitialPositions.set('center', { x: centerX, y: centerY });
    
    const onMouseMove = (event) => {
        if (isRotatingMultiSelection) {
            handleMultiSelectionRotation(event);
        }
    };
    
    const onMouseUp = () => {
        isRotatingMultiSelection = false;
        multiSelectionInitialPositions.clear();
        svg.removeEventListener('mousemove', onMouseMove);
        svg.removeEventListener('mouseup', onMouseUp);
        svg.style.cursor = 'default';
    };
    
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
    svg.style.cursor = 'grabbing';
}


function handleMultiSelectionRotation(e) {
    const center = multiSelectionInitialPositions.get('center');
    if (!center) return;
    
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
    const currentMouseAngle = Math.atan2(mouseY - center.y, mouseX - center.x) * 180 / Math.PI;
    const angleDiff = currentMouseAngle - startRotationMouseAngleMulti;
    
    // Convert angle difference to radians
    const angleRad = angleDiff * Math.PI / 180;
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);
    
    // Apply rotation to all selected shapes as ONE RIGID BODY
    selectedShapes.forEach(shape => {
        const initialData = multiSelectionInitialPositions.get(shape);
        if (!initialData) return;
        
        // Remove any individual selection indicators
        shape.removeSelection();
        
        switch (shape.shapeName) {
            case 'rectangle':
            case 'circle':
            case 'frame':
                // Only rotate position around center - keep everything else unchanged
                const newX = center.x + (initialData.relativeX * cosAngle - initialData.relativeY * sinAngle);
                const newY = center.y + (initialData.relativeX * sinAngle + initialData.relativeY * cosAngle);
                
                shape.x = newX;
                shape.y = newY;
                shape.width = initialData.width;
                shape.height = initialData.height;
                if (shape.rx !== undefined) shape.rx = initialData.rx;
                if (shape.ry !== undefined) shape.ry = initialData.ry;
                // Keep original rotation unchanged
                shape.rotation = initialData.rotation;
                break;
                
            case 'line':
            case 'arrow':
                // Rotate both endpoints around center
                const newStartX = center.x + (initialData.relativeStartX * cosAngle - initialData.relativeStartY * sinAngle);
                const newStartY = center.y + (initialData.relativeStartX * sinAngle + initialData.relativeStartY * cosAngle);
                const newEndX = center.x + (initialData.relativeEndX * cosAngle - initialData.relativeEndY * sinAngle);
                const newEndY = center.y + (initialData.relativeEndX * sinAngle + initialData.relativeEndY * cosAngle);
                
                shape.startPoint.x = newStartX;
                shape.startPoint.y = newStartY;
                shape.endPoint.x = newEndX;
                shape.endPoint.y = newEndY;
                
                if (shape.shapeName === 'arrow' && shape.arrowCurved) {
                    shape.initializeCurveControlPoints();
                }
                break;
                
            case 'freehandStroke':
                // Rotate all points around center
                if (initialData.relativePoints && shape.points) {
                    shape.points = initialData.relativePoints.map(relPoint => ({
                        x: center.x + (relPoint.x * cosAngle - relPoint.y * sinAngle),
                        y: center.y + (relPoint.x * sinAngle + relPoint.y * cosAngle)
                    }));
                    shape.updateBoundingBox();
                }
                break;
                
            default:
                // For text, image, etc. - only rotate position
                const newDefaultX = center.x + (initialData.relativeX * cosAngle - initialData.relativeY * sinAngle);
                const newDefaultY = center.y + (initialData.relativeX * sinAngle + initialData.relativeY * cosAngle);
                
                shape.x = newDefaultX;
                shape.y = newDefaultY;
                if (shape.width !== undefined) shape.width = initialData.width;
                if (shape.height !== undefined) shape.height = initialData.height;
                // Keep original rotation unchanged
                if (shape.rotation !== undefined) shape.rotation = initialData.rotation;
        }
        
        // Redraw the shape with new position
        if (typeof shape.draw === 'function') {
            shape.draw();
        }
    });
    
    // Update multi-selection controls to show the new bounds
    createMultiSelectionControls();
}


// Handle multi-selection mouse down
function handleMultiSelectionMouseDown(e) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    const { x, y } = getSVGCoordsFromMouse(e);
    
    // Check if clicking on multi-selection area or anchors
    if (selectedShapes.size > 1) {
        // Check if clicking on resize anchor
        const anchor = e.target.closest('.multi-selection-anchor');
        if (anchor) {
            const anchorIndex = parseInt(anchor.getAttribute('data-index'));
            startMultiSelectionResize(e, anchorIndex);
            return true;
        }
        
        // Check if clicking on rotation anchor
        if (e.target.closest('.multi-selection-rotation-anchor')) {
            startMultiSelectionRotation(e);
            return true;
        }
        
        // Check if clicking within multi-selection bounds for dragging
        if (isPointInMultiSelection(mouseX, mouseY)) {
            isDraggingMultiSelection = true;
            multiSelectionDragStart = { x: mouseX, y: mouseY };
            
            // Store initial positions for undo
            multiSelectionInitialPositions.clear();
            selectedShapes.forEach(shape => {
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
                multiSelectionInitialPositions.set(shape, shapeData);
            });
            
            svg.style.cursor = 'move';
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

// Handle multi-selection mouse move
function handleMultiSelectionMouseMove(e) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    
    if (isDraggingMultiSelection) {
        const dx = mouseX - multiSelectionDragStart.x;
        const dy = mouseY - multiSelectionDragStart.y;
        
        moveSelectedShapes(dx, dy);
        
        multiSelectionDragStart = { x: mouseX, y: mouseY };
        return true;
    }
    
    if (isMultiSelecting) {
        const { x, y } = getSVGCoordsFromMouse(e);
        updateMultiSelectionRect(x, y);
        return true;
    }
    
    // Update cursor for multi-selection area
    if (selectedShapes.size > 1 && isPointInMultiSelection(mouseX, mouseY)) {
        svg.style.cursor = 'move';
        return true;
    }
    
    return false;
}

// Handle multi-selection mouse up
function handleMultiSelectionMouseUp(e) {
    if (isDraggingMultiSelection) {
        // Create undo action for multi-selection move
        if (multiSelectionInitialPositions.size > 0) {
            // You can implement undo for multi-selection here
            multiSelectionInitialPositions.clear();
        }
        
        isDraggingMultiSelection = false;
        svg.style.cursor = 'default';
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
            selectShapesInRect(selectionBounds);
        }
        
        removeMultiSelectionRect();
        isMultiSelecting = false;
        return true;
    }
    
    return false;
}

export {
    handleMultiSelectionMouseDown,
    handleMultiSelectionMouseMove,
    handleMultiSelectionMouseUp,
    clearAllSelections,
    selectedShapes,
    isMultiSelecting,
    isDraggingMultiSelection
};