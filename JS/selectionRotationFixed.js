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

function removeMultiSelectionRect() {
    if (multiSelectionRect && multiSelectionRect.parentNode) {
        multiSelectionRect.parentNode.removeChild(multiSelectionRect);
    }
    multiSelectionRect = null;
}

function isShapeInSelectionRect(shape, selectionBounds) {
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
                height: Math.abs(shape.endPoint.y - shape.endPoint.y)
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
            shapeBounds = {
                x: shape.x || 0,
                y: shape.y || 0,
                width: shape.width || 0,
                height: shape.height || 0
            };
    }
    
    return !(selectionBounds.x > shapeBounds.x + shapeBounds.width ||
             selectionBounds.x + selectionBounds.width < shapeBounds.x ||
             selectionBounds.y > shapeBounds.y + shapeBounds.height ||
             selectionBounds.y + selectionBounds.height < shapeBounds.y);
}

class MultiSelection {
    constructor() {
        this.selectedShapes = new Set();
        this.tempGroup = null;
        this.anchors = [];
        this.outline = null;
        this.rotationAnchor = null;
        this.rotationLine = null;
        this.selectionPadding = 12;
        this.bounds = null;
        this.initialShapesData = new Map();
        
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;
        this.resizingAnchorIndex = null;
        this.dragStart = { x: 0, y: 0 };
        this.rotationCenter = { x: 0, y: 0 };
        this.startRotationMouseAngle = 0;
    }

    addShape(shape) {
        if (!this.selectedShapes.has(shape)) {
            this.selectedShapes.add(shape);
            shape.isSelected = true;
            if (typeof shape.removeSelection === 'function') {
                shape.removeSelection();
            }
            this.updateControls();
        }
    }

    removeShape(shape) {
        if (this.selectedShapes.has(shape)) {
            this.selectedShapes.delete(shape);
            shape.isSelected = false;
            if (typeof shape.removeSelection === 'function') {
                shape.removeSelection();
            }
            if (this.selectedShapes.size === 0) {
                this.clearSelection();
            } else {
                this.updateControls();
            }
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
        this.removeTempGroup();
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
        this.removeTempGroup();

        if (this.selectedShapes.size === 0) return;

        this.bounds = this.getBounds();
        if (!this.bounds) return;

        this.createTempGroup();
        this.createControls();
    }

    createTempGroup() {
        if (!this.tempGroup) {
            this.tempGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this.tempGroup.setAttribute('id', 'multi-selection-temp-group');
            this.tempGroup.setAttribute('transform', `translate(0,0) rotate(0,${this.bounds.x + this.bounds.width/2},${this.bounds.y + this.bounds.height/2})`);
            svg.appendChild(this.tempGroup);
        }

        // Append actual SVG elements of selected shapes to the temp group
        this.selectedShapes.forEach(shape => {
            let elementToAppend = null;
            if (shape.group) {
                elementToAppend = shape.group;
            } else if (shape.element) {
                elementToAppend = shape.element;
            } else if (shape.polyline) {
                elementToAppend = shape.polyline;
            }

            if (elementToAppend && elementToAppend.parentNode) {
                // Temporarily remove from original parent to append to tempGroup
                elementToAppend.parentNode.removeChild(elementToAppend);
                this.tempGroup.appendChild(elementToAppend);
            }
        });
    }

    removeTempGroup() {
        if (this.tempGroup && this.tempGroup.parentNode) {
            // Re-append shapes to their original parent (svg or canvasGroup)
            this.selectedShapes.forEach(shape => {
                let elementToReAppend = null;
                if (shape.group) {
                    elementToReAppend = shape.group;
                } else if (shape.element) {
                    elementToReAppend = shape.element;
                } else if (shape.polyline) {
                    elementToReAppend = shape.polyline;
                }

                if (elementToReAppend && elementToReAppend.parentNode === this.tempGroup) {
                    // Assuming they should go back to the main svg or a dedicated layer
                    svg.appendChild(elementToReAppend);
                }
            });
            this.tempGroup.parentNode.removeChild(this.tempGroup);
        }
        this.tempGroup = null;
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
        if (this.tempGroup) {
            let transform = this.tempGroup.transform.baseVal.consolidate();
            if (!transform) {
                transform = svg.createSVGTransform();
                this.tempGroup.transform.baseVal.appendItem(transform);
            }
            transform.setTranslate(transform.matrix.e + dx, transform.matrix.f + dy);
            
            // Manually update shape positions to reflect the move for controls
            this.selectedShapes.forEach(shape => {
                switch (shape.shapeName) {
                    case 'rectangle':
                    case 'circle':
                    case 'freehandStroke':
                    case 'frame':
                    case 'text':
                    case 'image':
                        shape.x += dx;
                        shape.y += dy;
                        break;
                    case 'line':
                    case 'arrow':
                        shape.startPoint.x += dx;
                        shape.startPoint.y += dy;
                        shape.endPoint.x += dx;
                        shape.endPoint.y += dy;
                        if (shape.controlPoint) {
                            shape.controlPoint.x += dx;
                            shape.controlPoint.y += dy;
                        }
                        break;
                }
                if (typeof shape.updateAttachedArrows === 'function') {
                    shape.updateAttachedArrows();
                }
            });
            this.updateControls();
        }
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

        // Store initial transform of the temp group
        const currentTransform = this.tempGroup.transform.baseVal.consolidate();
        this.initialTempGroupTransform = currentTransform ? currentTransform.matrix : svg.createSVGMatrix();

        if (typeof svg !== 'undefined') {
            svg.addEventListener('mousemove', this.handleRotationWrapper);
            svg.addEventListener('mouseup', this.endRotationWrapper);
            svg.style.cursor = 'grabbing';
        }
    }

    handleRotationWrapper = (e) => {
        if (this.isRotating) {
            this.handleRotation(e);
        }
    }

    endRotationWrapper = () => {
        if (this.isRotating) {
            this.isRotating = false;
            this.initialTempGroupTransform = null;
            if (typeof svg !== 'undefined') {
                svg.removeEventListener('mousemove', this.handleRotationWrapper);
                svg.removeEventListener('mouseup', this.endRotationWrapper);
                svg.style.cursor = 'default';
            }
            this.applyTempGroupTransformToShapes();
            this.updateControls(); // Re-render controls after applying transforms
        }
    }

    handleRotation(e) {
        if (!this.tempGroup) return;

        const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
        const currentMouseAngle = Math.atan2(mouseY - this.rotationCenter.y, mouseX - this.rotationCenter.x) * 180 / Math.PI;
        const angleDiff = currentMouseAngle - this.startRotationMouseAngle;
        
        const initialTranslateX = this.initialTempGroupTransform.e;
        const initialTranslateY = this.initialTempGroupTransform.f;

        let transform = this.tempGroup.transform.baseVal.consolidate();
        if (!transform) {
            transform = svg.createSVGTransform();
            this.tempGroup.transform.baseVal.appendItem(transform);
        }

        // Apply rotation around the bounds center
        const rotateTransform = svg.createSVGTransform();
        rotateTransform.setRotate(angleDiff, this.rotationCenter.x, this.rotationCenter.y);

        // Combine initial translation with new rotation
        const newMatrix = svg.createSVGMatrix()
                            .translate(initialTranslateX, initialTranslateY)
                            .multiply(rotateTransform.matrix);
        
        transform.setMatrix(newMatrix);
    }

    startResize(e, anchorIndex) {
        e.stopPropagation();
        e.preventDefault();
        
        this.isResizing = true;
        this.resizingAnchorIndex = anchorIndex;
        
        // Store initial bounds and transform of the temp group
        this.initialBounds = { ...this.bounds };
        const currentTransform = this.tempGroup.transform.baseVal.consolidate();
        this.initialTempGroupTransform = currentTransform ? currentTransform.matrix : svg.createSVGMatrix();

        if (typeof svg !== 'undefined') {
            svg.addEventListener('mousemove', this.handleResizeWrapper);
            svg.addEventListener('mouseup', this.endResizeWrapper);
        }
    }

    handleResizeWrapper = (e) => {
        if (this.isResizing) {
            this.handleResize(e);
        }
    }

    endResizeWrapper = () => {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizingAnchorIndex = null;
            this.initialBounds = null;
            this.initialTempGroupTransform = null;
            if (typeof svg !== 'undefined') {
                svg.removeEventListener('mousemove', this.handleResizeWrapper);
                svg.removeEventListener('mouseup', this.endResizeWrapper);
                svg.style.cursor = 'default';
            }
            this.applyTempGroupTransformToShapes();
            this.updateControls(); // Re-render controls after applying transforms
        }
    }

    handleResize(e) {
        if (!this.tempGroup || !this.initialBounds) return;

        const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
        
        let newX = this.initialBounds.x;
        let newY = this.initialBounds.y;
        let newWidth = this.initialBounds.width;
        let newHeight = this.initialBounds.height;

        switch (this.resizingAnchorIndex) {
            case 0: // top-left
                newX = mouseX;
                newY = mouseY;
                newWidth = this.initialBounds.x + this.initialBounds.width - mouseX;
                newHeight = this.initialBounds.y + this.initialBounds.height - mouseY;
                break;
            case 1: // top-right
                newY = mouseY;
                newWidth = mouseX - this.initialBounds.x;
                newHeight = this.initialBounds.y + this.initialBounds.height - mouseY;
                break;
            case 2: // bottom-left
                newX = mouseX;
                newWidth = this.initialBounds.x + this.initialBounds.width - mouseX;
                newHeight = mouseY - this.initialBounds.y;
                break;
            case 3: // bottom-right
                newWidth = mouseX - this.initialBounds.x;
                newHeight = mouseY - this.initialBounds.y;
                break;
            case 4: // top-center
                newY = mouseY;
                newHeight = this.initialBounds.y + this.initialBounds.height - mouseY;
                break;
            case 5: // bottom-center
                newHeight = mouseY - this.initialBounds.y;
                break;
            case 6: // left-center
                newX = mouseX;
                newWidth = this.initialBounds.x + this.initialBounds.width - mouseX;
                break;
            case 7: // right-center
                newWidth = mouseX - this.initialBounds.x;
                break;
        }

        // Clamp minimum size
        newWidth = Math.max(1, newWidth);
        newHeight = Math.max(1, newHeight);

        // Update the temporary group's transform
        let transform = this.tempGroup.transform.baseVal.consolidate();
        if (!transform) {
            transform = svg.createSVGTransform();
            this.tempGroup.transform.baseVal.appendItem(transform);
        }

        // Calculate scaling and translation
        const scaleX = newWidth / this.initialBounds.width;
        const scaleY = newHeight / this.initialBounds.height;
        const translateX = newX - this.initialBounds.x;
        const translateY = newY - this.initialBounds.y;

        const newMatrix = svg.createSVGMatrix()
                            .translate(translateX, translateY)
                            .scaleNonUniform(scaleX, scaleY)
                            .multiply(this.initialTempGroupTransform); // Apply initial rotation/translation if any

        transform.setMatrix(newMatrix);
        
        // Update controls immediately for visual feedback
        this.bounds = { x: newX, y: newY, width: newWidth, height: newHeight };
        this.createControls(); // Recreate controls based on new bounds
    }

    startDrag(e) {
        this.isDragging = true;
        isDraggingMultiSelection = true;
        const { x, y } = getSVGCoordsFromMouse(e);
        this.dragStart = { x, y };
        
        const currentTransform = this.tempGroup.transform.baseVal.consolidate();
        this.initialTempGroupTransform = currentTransform ? currentTransform.matrix : svg.createSVGMatrix();
        
        if (typeof svg !== 'undefined') {
            svg.style.cursor = 'move';
            svg.addEventListener('mousemove', this.handleDragWrapper);
            svg.addEventListener('mouseup', this.endDragWrapper);
        }
    }

    handleDragWrapper = (e) => {
        if (this.isDragging) {
            this.handleDrag(e);
        }
    }

    endDragWrapper = () => {
        if (this.isDragging) {
            this.isDragging = false;
            isDraggingMultiSelection = false;
            if (typeof svg !== 'undefined') {
                svg.removeEventListener('mousemove', this.handleDragWrapper);
                svg.removeEventListener('mouseup', this.endDragWrapper);
                svg.style.cursor = 'default';
            }
            this.applyTempGroupTransformToShapes();
            this.updateControls(); // Re-render controls after applying transforms
        }
    }

    handleDrag(e) {
        if (!this.tempGroup) return;
        const { x, y } = getSVGCoordsFromMouse(e);
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;
        
        let transform = this.tempGroup.transform.baseVal.consolidate();
        if (!transform) {
            transform = svg.createSVGTransform();
            this.tempGroup.transform.baseVal.appendItem(transform);
        }

        const newMatrix = svg.createSVGMatrix()
                            .translate(dx, dy)
                            .multiply(this.initialTempGroupTransform);
        
        transform.setMatrix(newMatrix);
        
        // Update bounds for control redrawing
        this.bounds.x += dx;
        this.bounds.y += dy;
        this.dragStart = { x, y }; // Update dragStart for next move
        this.createControls(); // Recreate controls based on new bounds
    }

    applyTempGroupTransformToShapes() {
        if (!this.tempGroup) return;

        const groupTransformMatrix = this.tempGroup.transform.baseVal.consolidate().matrix;
        
        this.selectedShapes.forEach(shape => {
            let element = null;
            if (shape.group) {
                element = shape.group;
            } else if (shape.element) {
                element = shape.element;
            } else if (shape.polyline) {
                element = shape.polyline;
            }

            if (element && element.parentNode === this.tempGroup) {
                // Get the current local transform of the shape
                let shapeLocalMatrix = svg.createSVGMatrix();
                if (element.transform && element.transform.baseVal.numberOfItems > 0) {
                    shapeLocalMatrix = element.transform.baseVal.consolidate().matrix;
                }

                // Combine the shape's local transform with the group's transform
                const finalMatrix = shapeLocalMatrix.multiply(groupTransformMatrix);

                // Decompose the matrix to update shape properties
                // This is a simplified decomposition, a full decomposition can be complex
                // For this scenario, we primarily care about translation and potentially scaling/rotation
                
                // For simplicity, let's derive new x, y, width, height from the transformed BBox
                const bbox = element.getBBox();
                const transformedP1 = finalMatrix.transformPoint(svg.createSVGPoint(bbox.x, bbox.y));
                const transformedP2 = finalMatrix.transformPoint(svg.createSVGPoint(bbox.x + bbox.width, bbox.y + bbox.height));

                const newX = transformedP1.x;
                const newY = transformedP1.y;
                const newWidth = transformedP2.x - transformedP1.x;
                const newHeight = transformedP2.y - transformedP1.y;
                
                // Clear the element's transform as its position/size will be updated directly
                if (element.transform && element.transform.baseVal) {
                    element.transform.baseVal.clear();
                }

                // Update shape properties based on its new absolute position/size
                switch (shape.shapeName) {
                    case 'rectangle':
                    case 'frame':
                        shape.x = newX;
                        shape.y = newY;
                        shape.width = newWidth;
                        shape.height = newHeight;
                        break;
                    case 'circle':
                        // Assuming uniform scaling, adjust rx/ry
                        shape.x = newX + newWidth / 2;
                        shape.y = newY + newHeight / 2;
                        shape.rx = newWidth / 2;
                        shape.ry = newHeight / 2;
                        break;
                    case 'line':
                    case 'arrow':
                        // This is more complex as lines don't have width/height directly.
                        // For lines/arrows, transforming the individual start/end points is better.
                        // Since they were already moved with the group, their relative positions are maintained.
                        // We need to calculate new absolute positions based on the group's transform.
                        const startPoint = svg.createSVGPoint(shape.startPoint.x, shape.startPoint.y);
                        const endPoint = svg.createSVGPoint(shape.endPoint.x, shape.endPoint.y);
                        
                        const newStart = groupTransformMatrix.transformPoint(startPoint);
                        const newEnd = groupTransformMatrix.transformPoint(endPoint);

                        shape.startPoint.x = newStart.x;
                        shape.startPoint.y = newStart.y;
                        shape.endPoint.x = newEnd.x;
                        shape.endPoint.y = newEnd.y;
                        
                        if (shape.controlPoint) {
                            const controlPoint = svg.createSVGPoint(shape.controlPoint.x, shape.controlPoint.y);
                            const newControl = groupTransformMatrix.transformPoint(controlPoint);
                            shape.controlPoint.x = newControl.x;
                            shape.controlPoint.y = newControl.y;
                        }
                        break;
                    case 'freehandStroke':
                        // Transform each point in the polyline
                        shape.points = shape.points.map(p => {
                            const point = svg.createSVGPoint(p.x, p.y);
                            const newPoint = groupTransformMatrix.transformPoint(point);
                            return { x: newPoint.x, y: newPoint.y };
                        });
                        if (typeof shape.updateBoundingBox === 'function') {
                            shape.updateBoundingBox();
                        }
                        break;
                    case 'text':
                        // Text position usually refers to x,y of the text element itself
                        // This might require adjusting text 'x' and 'y' attributes and font size
                        // For now, let's just use the transformed bbox top-left
                        shape.x = newX;
                        shape.y = newY; // This might need adjustment based on text baseline
                        // For scaled text, might need to derive new font-size based on scale factors
                        break;
                    case 'image':
                        shape.x = newX;
                        shape.y = newY;
                        shape.width = newWidth;
                        shape.height = newHeight;
                        break;
                }
                
                // Re-append the element to the main SVG or its correct layer
                svg.appendChild(element); // Re-append to main SVG
                shape.draw(); // Redraw to update internal properties and visual representation

                if (typeof shape.updateAttachedArrows === 'function') {
                    shape.updateAttachedArrows();
                }
            }
        });

        // Clear the transform on the temporary group itself
        this.tempGroup.transform.baseVal.clear();
    }
}

const multiSelection = new MultiSelection();

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

function handleMultiSelectionMouseDown(e) {
    const { x, y } = getSVGCoordsFromMouse(e);
    
    if (multiSelection.selectedShapes.size > 0) { // Check for existing selection
        const anchor = e.target.closest('.multi-selection-anchor');
        if (anchor) {
            const anchorIndex = parseInt(anchor.getAttribute('data-index'));
            multiSelection.startResize(e, anchorIndex);
            return true;
        }
        
        if (e.target.closest('.multi-selection-rotation-anchor')) {
            multiSelection.startRotation(e);
            return true;
        }
        
        if (multiSelection.isPointInBounds(x, y)) {
            multiSelection.startDrag(e);
            return true;
        }
    }
    
    multiSelectionStart = { x, y };
    isMultiSelecting = true;
    createMultiSelectionRect(x, y);
    
    clearAllSelections();
    
    return true;
}

function handleMultiSelectionMouseMove(e) {
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
        const { x, y } = getSVGCoordsFromMouse(e);
        updateMultiSelectionRect(x, y);
        return true;
    }
    
    if (multiSelection.selectedShapes.size > 0 && multiSelection.isPointInBounds(e.x, e.y)) {
        if (typeof svg !== 'undefined' && !multiSelection.isDragging && !multiSelection.isResizing && !multiSelection.isRotating) {
            svg.style.cursor = 'move';
        }
        return true;
    } else {
        if (typeof svg !== 'undefined' && !multiSelection.isDragging && !multiSelection.isResizing && !multiSelection.isRotating) {
            // Restore default cursor if outside multi-selection
            svg.style.cursor = 'default';
        }
    }
    
    return false;
}

function handleMultiSelectionMouseUp(e) {
    if (multiSelection.isDragging) {
        multiSelection.endDrag();
        return true;
    }
    
    if (multiSelection.isResizing) {
        multiSelection.endResizeWrapper();
        return true;
    }

    if (multiSelection.isRotating) {
        multiSelection.endRotationWrapper();
        return true;
    }
    
    if (isMultiSelecting) {
        const { x, y } = getSVGCoordsFromMouse(e);
        
        const selectionBounds = {
            x: Math.min(multiSelectionStart.x, x),
            y: Math.min(multiSelectionStart.y, y),
            width: Math.abs(x - multiSelectionStart.x),
            height: Math.abs(y - multiSelectionStart.y)
        };
        
        if (selectionBounds.width > 5 && selectionBounds.height > 5) {
            multiSelection.selectShapesInRect(selectionBounds);
        } else {
            // If it's a click, check if it's on an existing shape
            let clickedOnShape = false;
            if (typeof shapes !== 'undefined') {
                for (let i = shapes.length - 1; i >= 0; i--) {
                    const shape = shapes[i];
                    if (shape.isPointInShape && shape.isPointInShape(x, y)) {
                        multiSelection.clearSelection();
                        multiSelection.addShape(shape);
                        clickedOnShape = true;
                        break;
                    }
                }
            }
            if (!clickedOnShape) {
                multiSelection.clearSelection();
            }
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
    selectShapesInRect,
    createMultiSelectionControls,
    removeMultiSelectionControls,
    isPointInMultiSelection,
    moveSelectedShapes,
    multiSelection,
    isDraggingMultiSelection,
    isMultiSelecting
};