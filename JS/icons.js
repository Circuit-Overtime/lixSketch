import { pushCreateAction, pushDeleteAction, pushTransformAction, pushFrameAttachmentAction } from './undoAndRedo.js';
import { updateAttachedArrows, cleanupAttachments } from './drawArrow.js';

let isDraggingIcon = false;
let iconToPlace = null;
let iconX = 0;
let iconY = 0;
let scaleFactor = 0.2; 
let currentIconElement = null; 

let selectedIcon = null;
let originalX, originalY, originalWidth, originalHeight;
let currentAnchor = null; 
let isDragging = false;
let isRotatingIcon = false;
let dragOffsetX, dragOffsetY;
let startRotationMouseAngle = null;
let startIconRotation = null;
let iconRotation = 0;
let aspect_ratio_lock = true;
const minIconSize = 20; 

// Frame attachment variables
let draggedShapeInitialFrameIcon = null;
let hoveredFrameIcon = null;


function getSVGElement() {
    return document.getElementById('freehand-canvas');
}

// Icon class to make it consistent with other shapes
class IconShape {
    constructor(element) {
        this.element = element;
        this.shapeName = 'icon';
        this.shapeID = element.shapeID || `icon-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;
        
        // Frame attachment properties
        this.parentFrame = null;
        
        // Update element attributes
        this.element.setAttribute('type', 'icon');
        this.element.shapeID = this.shapeID;
        
        // Create a group wrapper for the icon to work with frames properly
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.group.setAttribute('id', this.shapeID);
        
        // Move the icon element into the group
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.group.appendChild(this.element);
        
        const svg = getSVGElement();
        if (svg) {
            svg.appendChild(this.group);
        }
    }
    
    // ...existing code...
    get x() {
        return parseFloat(this.element.getAttribute('x')) || 0;
    }
    
    set x(value) {
        this.element.setAttribute('x', value);
        this.element.setAttribute('data-shape-x', value);
    }
    
    get y() {
        return parseFloat(this.element.getAttribute('y')) || 0;
    }
    
    set y(value) {
        this.element.setAttribute('y', value);
        this.element.setAttribute('data-shape-y', value);
    }
    
    get width() {
        return parseFloat(this.element.getAttribute('width')) || 100;
    }
    
    set width(value) {
        this.element.setAttribute('width', value);
        this.element.setAttribute('data-shape-width', value);
    }
    
    get height() {
        return parseFloat(this.element.getAttribute('height')) || 100;
    }
    
    set height(value) {
        this.element.setAttribute('height', value);
        this.element.setAttribute('data-shape-height', value);
    }
    
    get rotation() {
        const transform = this.element.getAttribute('transform');
        if (transform) {
            const rotateMatch = transform.match(/rotate\(([^,]+)/);
            if (rotateMatch) {
                return parseFloat(rotateMatch[1]);
            }
        }
        return 0;
    }
    
    set rotation(value) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        this.element.setAttribute('transform', `rotate(${value}, ${centerX}, ${centerY})`);
        this.element.setAttribute('data-shape-rotation', value);
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        
        // Update transform for rotation
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        this.element.setAttribute('transform', `rotate(${this.rotation}, ${centerX}, ${centerY})`);
        
        // Only update frame containment if we're actively dragging the shape itself
        // and not being moved by a parent frame
        if (isDragging && !this.isBeingMovedByFrame) {
            this.updateFrameContainment();
        }
        
        // Update attached arrows
        if (typeof updateAttachedArrows === 'function') {
            updateAttachedArrows(this.element);
        }
    }

    updateFrameContainment() {
        // Don't update if we're being moved by a frame
        if (this.isBeingMovedByFrame) return;
        
        let targetFrame = null;
        
        // Find which frame this shape is over
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.forEach(shape => {
                if (shape.shapeName === 'frame' && shape.isShapeInFrame(this)) {
                    targetFrame = shape;
                }
            });
        }
        
        // If we have a parent frame and we're being dragged, temporarily remove clipping
        if (this.parentFrame && isDragging) {
            this.parentFrame.temporarilyRemoveFromFrame(this);
        }
        
        // Update frame highlighting
        if (hoveredFrameIcon && hoveredFrameIcon !== targetFrame) {
            hoveredFrameIcon.removeHighlight();
        }
        
        if (targetFrame && targetFrame !== hoveredFrameIcon) {
            targetFrame.highlightFrame();
        }
        
        hoveredFrameIcon = targetFrame;
    }

    contains(x, y) {
        const iconX = this.x;
        const iconY = this.y;
        const iconWidth = this.width;
        const iconHeight = this.height;
        
        return x >= iconX && x <= iconX + iconWidth && y >= iconY && y <= iconY + iconHeight;
    }

    draw() {
    }

    removeSelection() {
        removeSelectionOutline();
    }

    selectShape() {
        selectIcon({ target: this.element, stopPropagation: () => {} });
    }
}

function wrapIconElement(element) {
    const iconShape = new IconShape(element);
    return iconShape;
}

document.getElementById("importIcon").addEventListener('click', () => {
    console.log('Import icon clicked');
    isIconToolActive = true;
    console.log('isIconToolActive set to:', isIconToolActive);

    // Use the building.svg icon from the root
    const hardcodedIconPath = 'building.svg';
    loadHardcodedIcon(hardcodedIconPath);
});

const loadHardcodedIcon = (iconPath) => {
    console.log('Loading hardcoded icon:', iconPath);
    fetch(iconPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load icon: ${response.statusText}`);
            }
            return response.text();
        })
        .then(svgContent => {
            console.log('Icon loaded successfully:', svgContent);
            iconToPlace = svgContent;
            isDraggingIcon = true;
            console.log('Icon ready to place, isDraggingIcon:', isDraggingIcon);
        })
        .catch(error => {
            console.error('Failed to load the hardcoded icon:', error);
            console.error('Icon path:', iconPath);
        });
};

// Add coordinate conversion function like in other tools
function getSVGCoordsFromMouse(e) {
    const svg = getSVGElement();
    if (!svg) {
        console.error('SVG element not found');
        return { x: 0, y: 0 };
    }
    
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}

// Event handler for mousemove on the SVG
const handleMouseMoveIcon = (e) => {
    if (!isDraggingIcon || !iconToPlace || !isIconToolActive) return;

    // Get mouse coordinates relative to the SVG element
    const { x, y } = getSVGCoordsFromMouse(e);
    iconX = x;
    iconY = y;

    drawMiniatureIcon();
    
    // Check for frame containment while placing icon (but don't apply clipping yet)
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        shapes.forEach(frame => {
            if (frame.shapeName === 'frame') {
                // Create temporary icon bounds for frame checking
                const tempIconBounds = {
                    x: iconX - 50, // Half of miniature width
                    y: iconY - 50, // Approximate half height
                    width: 100,
                    height: 100
                };
                
                if (frame.isShapeInFrame(tempIconBounds)) {
                    frame.highlightFrame();
                    hoveredFrameIcon = frame;
                } else if (hoveredFrameIcon === frame) {
                    frame.removeHighlight();
                    hoveredFrameIcon = null;
                }
            }
        });
    }
};

const drawMiniatureIcon = () => {
    if (!isDraggingIcon || !iconToPlace || !isIconToolActive) return;

    const svg = getSVGElement();
    if (!svg) {
        console.error('SVG element not found for miniature icon');
        return;
    }

    const miniatureSize = 50; // Fixed size for miniature

    // Remove the previous miniature icon, if it exists
    if (currentIconElement) {
        svg.removeChild(currentIconElement);
        currentIconElement = null;
    }

    // Create a temporary div to parse the SVG content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = iconToPlace;
    const svgElement = tempDiv.querySelector('svg');
    
    if (svgElement) {
        // Create an SVG group for the miniature icon
        const iconGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        iconGroup.setAttribute("transform", `translate(${iconX - miniatureSize / 2}, ${iconY - miniatureSize / 2}) scale(${miniatureSize / 24})`);
        
        // Copy the SVG content (the paths)
        const paths = svgElement.querySelectorAll('path');
        paths.forEach(path => {
            const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            newPath.setAttribute('d', path.getAttribute('d'));
            newPath.setAttribute('fill', '#666');
            iconGroup.appendChild(newPath);
        });
        
        iconGroup.setAttribute("style", "pointer-events: none; opacity: 0.7;");
        iconGroup.setAttribute("class", "miniature-icon");
        
        currentIconElement = iconGroup;
        svg.appendChild(currentIconElement);
    }
};

// Update the handleMouseDownIcon function to create proper group structure
const handleMouseDownIcon = async (e) => {
    if (!isDraggingIcon || !iconToPlace || !isIconToolActive) {
        // Handle icon selection if selection tool is active
        if (isSelectionToolActive) {
            const clickedIcon = e.target.closest('[type="icon"]');
            if (clickedIcon) {
                selectIcon({ target: clickedIcon, stopPropagation: () => e.stopPropagation() });
                return;
            }
        }
        return;
    }

    try {
        const svg = getSVGElement();
        if (!svg) {
            throw new Error('SVG element not found');
        }

        // Remove the miniature
        if (currentIconElement) {
            svg.removeChild(currentIconElement);
            currentIconElement = null;
        }

        // Calculate actual dimensions of the placed icon
        const placedIconSize = 100; // Adjust as needed

        // Get SVG coordinates
        const { x: placedX, y: placedY } = getSVGCoordsFromMouse(e);

        // Create a temporary div to parse the SVG content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = iconToPlace;
        const svgElement = tempDiv.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Invalid SVG content');
        }

        // Create a new SVG group element for the final icon
        const finalIconGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const finalX = placedX - placedIconSize / 2;
        const finalY = placedY - placedIconSize / 2;
        
        finalIconGroup.setAttribute("transform", `translate(${finalX}, ${finalY}) scale(${placedIconSize / 24})`);
        
        // Copy the SVG content (the paths)
        const paths = svgElement.querySelectorAll('path');
        paths.forEach(path => {
            const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
            newPath.setAttribute('d', path.getAttribute('d'));
            newPath.setAttribute('fill', '#fff');
            finalIconGroup.appendChild(newPath);
        });

        // Store data for undo/redo and positioning
        finalIconGroup.setAttribute('x', finalX);
        finalIconGroup.setAttribute('y', finalY);
        finalIconGroup.setAttribute('width', placedIconSize);
        finalIconGroup.setAttribute('height', placedIconSize);
        
        // Add arrow attachment support data attributes
        finalIconGroup.setAttribute('type', 'icon');
        finalIconGroup.setAttribute('data-shape-x', finalX);
        finalIconGroup.setAttribute('data-shape-y', finalY);
        finalIconGroup.setAttribute('data-shape-width', placedIconSize);
        finalIconGroup.setAttribute('data-shape-height', placedIconSize);
        finalIconGroup.setAttribute('data-shape-rotation', 0);
        finalIconGroup.shapeID = `icon-${String(Date.now()).slice(0, 8)}-${Math.floor(Math.random() * 10000)}`;

        // Add the final icon to the SVG
        svg.appendChild(finalIconGroup);

        // Create IconShape wrapper for frame functionality
        const iconShape = wrapIconElement(finalIconGroup);

        // Add to shapes array for arrow attachment and frame functionality
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            shapes.push(iconShape);
            console.log('Icon added to shapes array for arrow attachment and frame functionality');
        } else {
            console.warn('shapes array not found - arrows and frames may not work with icons');
        }

        // Check for frame containment and track attachment
        const finalFrame = hoveredFrameIcon;
        if (finalFrame) {
            finalFrame.addShapeToFrame(iconShape);
            // Track the attachment for undo
            pushFrameAttachmentAction(finalFrame, iconShape, 'attach', null);
        }

        // Add to undo stack for icon creation
        pushCreateAction({
            type: 'icon',
            element: iconShape,
            remove: () => {
                if (iconShape.group && iconShape.group.parentNode) {
                    iconShape.group.parentNode.removeChild(iconShape.group);
                }
                // Remove from shapes array
                if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
                    const idx = shapes.indexOf(iconShape);
                    if (idx !== -1) shapes.splice(idx, 1);
                }
                // Clean up arrow attachments when icon is removed
                if (typeof cleanupAttachments === 'function') {
                    cleanupAttachments(finalIconGroup);
                }
            },
            restore: () => {
                svg.appendChild(iconShape.group);
                // Add back to shapes array
                if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
                    if (shapes.indexOf(iconShape) === -1) {
                        shapes.push(iconShape);
                    }
                }
            }
        });

        // Add click event to the newly added icon
        finalIconGroup.addEventListener('click', selectIcon);

        // Clear frame highlighting
        if (hoveredFrameIcon) {
            hoveredFrameIcon.removeHighlight();
            hoveredFrameIcon = null;
        }

        console.log('Icon placed successfully:', finalIconGroup);

    } catch (error) {
        console.error("Error placing icon:", error);
        isDraggingIcon = false;
        iconToPlace = null;
        isIconToolActive = false;
    } finally {
        isDraggingIcon = false;
        iconToPlace = null;
        isIconToolActive = false;
    }
};

const handleMouseUpIcon = (e) => {
    // Handle icon deselection when clicking outside
    if (isSelectionToolActive) {
        // Check if we clicked on an icon or icon-related element
        const clickedElement = e.target;
        const isIconElement = clickedElement.closest('[type="icon"]');
        const isAnchorElement = clickedElement.classList.contains('resize-anchor') || 
                               clickedElement.classList.contains('rotation-anchor') ||
                               clickedElement.classList.contains('selection-outline');
        
        // If we didn't click on an icon or its controls, deselect
        if (!isIconElement && !isAnchorElement && selectedIcon) {
            removeSelectionOutline();
            selectedIcon = null;
        }
    }
    
    // Clear frame highlighting if placing icon
    if (hoveredFrameIcon) {
        hoveredFrameIcon.removeHighlight();
        hoveredFrameIcon = null;
    }
};

function selectIcon(event) {
    if (!isSelectionToolActive) return;

    event.stopPropagation(); // Prevent click from propagating to the SVG

    if (selectedIcon) {
        removeSelectionOutline();
    }

    selectedIcon = event.target.closest('[type="icon"]');
    
    // Get the current rotation from the icon transform attribute
    const transform = selectedIcon.getAttribute('transform');
    if (transform) {
        const rotateMatch = transform.match(/rotate\(([^,]+)/);
        if (rotateMatch) {
            iconRotation = parseFloat(rotateMatch[1]);
        }
    } else {
        iconRotation = 0;
    }
    
    addSelectionOutline();

    // Store original dimensions for resizing
    originalX = parseFloat(selectedIcon.getAttribute('x')) || 0;
    originalY = parseFloat(selectedIcon.getAttribute('y')) || 0;
    originalWidth = parseFloat(selectedIcon.getAttribute('width')) || 100;
    originalHeight = parseFloat(selectedIcon.getAttribute('height')) || 100;

     // Add drag event listeners to the selected icon
     selectedIcon.addEventListener('mousedown', startDrag);
     selectedIcon.addEventListener('mouseup', stopDrag);
     selectedIcon.addEventListener('mouseleave', stopDrag);
}

function addSelectionOutline() {
    if (!selectedIcon) return;

    const svg = getSVGElement();
    if (!svg) return;

    const x = parseFloat(selectedIcon.getAttribute('x')) || 0;
    const y = parseFloat(selectedIcon.getAttribute('y')) || 0;
    const width = parseFloat(selectedIcon.getAttribute('width')) || 100;
    const height = parseFloat(selectedIcon.getAttribute('height')) || 100;

    const selectionPadding = 8;
    const expandedX = x - selectionPadding;
    const expandedY = y - selectionPadding;
    const expandedWidth = width + 2 * selectionPadding;
    const expandedHeight = height + 2 * selectionPadding;

    // Create a dashed outline
    const outlinePoints = [
        [expandedX, expandedY],
        [expandedX + expandedWidth, expandedY],
        [expandedX + expandedWidth, expandedY + expandedHeight],
        [expandedX, expandedY + expandedHeight],
        [expandedX, expandedY]
    ];
    const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    outline.setAttribute("points", pointsAttr);
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", "#5B57D1");
    outline.setAttribute("stroke-width", 1.5);
    outline.setAttribute("stroke-dasharray", "4 2");
    outline.setAttribute("style", "pointer-events: none;");
    outline.setAttribute("class", "selection-outline");

    // Apply the same rotation as the icon
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    outline.setAttribute('transform', `rotate(${iconRotation}, ${centerX}, ${centerY})`);

    svg.appendChild(outline);

    // Add resize anchors
    addResizeAnchors(expandedX, expandedY, expandedWidth, expandedHeight, centerX, centerY);
    
    // Add rotation anchor
    addRotationAnchor(expandedX, expandedY, expandedWidth, expandedHeight, centerX, centerY);
}

function removeSelectionOutline() {
    const svg = getSVGElement();
    if (!svg) return;

    // Remove the selection outline
    const outline = svg.querySelector(".selection-outline");
    if (outline) {
        svg.removeChild(outline);
    }

    // Remove resize anchors
    removeResizeAnchors();
    
    // Remove rotation anchor
    removeRotationAnchor();

    // Remove drag event listeners
    if (selectedIcon) {
        selectedIcon.removeEventListener('mousedown', startDrag);
        selectedIcon.removeEventListener('mouseup', stopDrag);
        selectedIcon.removeEventListener('mouseleave', stopDrag);
    }
}

function addResizeAnchors(x, y, width, height, centerX, centerY) {
    const svg = getSVGElement();
    if (!svg) return;

    const anchorSize = 10;
    const anchorStrokeWidth = 2;

    const positions = [
        { x: x, y: y }, // Top-left
        { x: x + width, y: y }, // Top-right
        { x: x, y: y + height }, // Bottom-left
        { x: x + width, y: y + height } // Bottom-right
    ];

    positions.forEach((pos, i) => {
        const anchor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        anchor.setAttribute("x", pos.x - anchorSize / 2);
        anchor.setAttribute("y", pos.y - anchorSize / 2);
        anchor.setAttribute("width", anchorSize);
        anchor.setAttribute("height", anchorSize);
        anchor.setAttribute("fill", "#121212");
        anchor.setAttribute("stroke", "#5B57D1");
        anchor.setAttribute("stroke-width", anchorStrokeWidth);
        anchor.setAttribute("class", "resize-anchor");
        anchor.style.cursor = ["nw-resize", "ne-resize", "sw-resize", "se-resize"][i];

        // Apply the same rotation as the icon
        anchor.setAttribute('transform', `rotate(${iconRotation}, ${centerX}, ${centerY})`);

        svg.appendChild(anchor);

        // Add event listeners for resizing
        anchor.addEventListener('mousedown', startResize);
        anchor.addEventListener('mouseup', stopResize);
    });
}

function addRotationAnchor(x, y, width, height, centerX, centerY) {
    const svg = getSVGElement();
    if (!svg) return;

    const anchorStrokeWidth = 2;
    const rotationAnchorPos = { x: x + width / 2, y: y - 30 };
    
    const rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
    rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
    rotationAnchor.setAttribute('r', 8);
    rotationAnchor.setAttribute('class', 'rotation-anchor');
    rotationAnchor.setAttribute('fill', '#121212');
    rotationAnchor.setAttribute('stroke', '#5B57D1');
    rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
    rotationAnchor.setAttribute('style', 'pointer-events: all;');
    
    // Apply the same rotation as the icon
    rotationAnchor.setAttribute('transform', `rotate(${iconRotation}, ${centerX}, ${centerY})`);
    
    svg.appendChild(rotationAnchor);

    // Add event listeners for rotation
    rotationAnchor.addEventListener('mousedown', startRotation);
    rotationAnchor.addEventListener('mouseup', stopRotation);
    
    rotationAnchor.addEventListener('mouseover', function () {
        if (!isRotatingIcon && !isDragging) {
            rotationAnchor.style.cursor = 'grab';
        }
    });
    
    rotationAnchor.addEventListener('mouseout', function () {
        if (!isRotatingIcon && !isDragging) {
            rotationAnchor.style.cursor = 'default';
        }
    });
}

function removeRotationAnchor() {
    const svg = getSVGElement();
    if (!svg) return;

    const rotationAnchor = svg.querySelector(".rotation-anchor");
    if (rotationAnchor) {
        svg.removeChild(rotationAnchor);
    }
}

function removeResizeAnchors() {
    const svg = getSVGElement();
    if (!svg) return;

    const anchors = svg.querySelectorAll(".resize-anchor");
    anchors.forEach(anchor => svg.removeChild(anchor));
}

// ...existing code for startResize, stopResize, resizeIcon, startDrag, dragIcon, stopDrag, 
// startRotation, rotateIcon, stopRotation, stopInteracting, deleteCurrentIcon...

function startResize(event) {
    event.preventDefault();
    event.stopPropagation();

    currentAnchor = event.target;
    
    // Store original values at the start of resize
    originalX = parseFloat(selectedIcon.getAttribute('x')) || 0;
    originalY = parseFloat(selectedIcon.getAttribute('y')) || 0;
    originalWidth = parseFloat(selectedIcon.getAttribute('width')) || 100;
    originalHeight = parseFloat(selectedIcon.getAttribute('height')) || 100;
    
    const svg = getSVGElement();
    if (svg) {
        svg.addEventListener('mousemove', resizeIcon);
    }
    document.addEventListener('mouseup', stopResize);
}

function stopResize(event) {
    stopInteracting();
    document.removeEventListener('mouseup', stopResize);
}

function resizeIcon(event) {
    if (!selectedIcon || !currentAnchor) return;

    const { x: globalX, y: globalY } = getSVGCoordsFromMouse(event);

    // Calculate resize deltas
    let dx = globalX - originalX;
    let dy = globalY - originalY;

    let newWidth = originalWidth;
    let newHeight = originalHeight;
    let newX = originalX;
    let newY = originalY;

    switch (currentAnchor.style.cursor) {
        case "nw-resize":
            newWidth = originalWidth - dx;
            newHeight = originalHeight - dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth; // Square icons
            }
            newX = originalX + (originalWidth - newWidth);
            newY = originalY + (originalHeight - newHeight);
            break;
        case "ne-resize":
            newWidth = dx;
            newHeight = originalHeight - dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth;
                dy = originalHeight - newHeight;
            }
            newX = originalX;
            newY = originalY + (originalHeight - newHeight);
            break;
        case "sw-resize":
            newWidth = originalWidth - dx;
            newHeight = dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth;
            }
            newX = originalX + (originalWidth - newWidth);
            newY = originalY;
            break;
        case "se-resize":
            newWidth = dx;
            newHeight = dy;
            if (aspect_ratio_lock) {
                newHeight = newWidth;
            }
            newX = originalX;
            newY = originalY;
            break;
    }

    // Ensure minimum size
    newWidth = Math.max(minIconSize, newWidth);
    newHeight = Math.max(minIconSize, newHeight);

    // Apply the new dimensions and position
    selectedIcon.setAttribute('width', newWidth);
    selectedIcon.setAttribute('height', newHeight);
    selectedIcon.setAttribute('x', newX);
    selectedIcon.setAttribute('y', newY);

    // Update data attributes for arrow attachment
    selectedIcon.setAttribute('data-shape-x', newX);
    selectedIcon.setAttribute('data-shape-y', newY);
    selectedIcon.setAttribute('data-shape-width', newWidth);
    selectedIcon.setAttribute('data-shape-height', newHeight);

    // Update the transform for scaling
    const scale = newWidth / 24; // Using 24 as base since building.svg is 24x24
    selectedIcon.setAttribute('transform', `translate(${newX}, ${newY}) scale(${scale}) rotate(${iconRotation})`);

    // Update attached arrows during resize
    if (typeof updateAttachedArrows === 'function') {
        updateAttachedArrows(selectedIcon);
    }

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}

function startDrag(event) {
    if (!isSelectionToolActive || !selectedIcon) return;

    event.preventDefault();
    event.stopPropagation();

    isDragging = true;
    
    // Store original values at the start of drag
    originalX = parseFloat(selectedIcon.getAttribute('x')) || 0;
    originalY = parseFloat(selectedIcon.getAttribute('y')) || 0;
    originalWidth = parseFloat(selectedIcon.getAttribute('width')) || 100;
    originalHeight = parseFloat(selectedIcon.getAttribute('height')) || 100;

    // Find the IconShape wrapper for frame functionality
    let iconShape = null;
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        iconShape = shapes.find(shape => shape.shapeName === 'icon' && shape.element === selectedIcon);
    }

    if (iconShape) {
        // Store initial frame state
        draggedShapeInitialFrameIcon = iconShape.parentFrame || null;
        
        // Temporarily remove from frame clipping if dragging
        if (iconShape.parentFrame) {
            iconShape.parentFrame.temporarilyRemoveFromFrame(iconShape);
        }
    }

    const { x, y } = getSVGCoordsFromMouse(event);
    dragOffsetX = x - originalX;
    dragOffsetY = y - originalY;

    const svg = getSVGElement();
    if (svg) {
        svg.addEventListener('mousemove', dragIcon);
    }
    document.addEventListener('mouseup', stopDrag);
}

function dragIcon(event) {
    if (!isDragging || !selectedIcon) return;

    const { x, y } = getSVGCoordsFromMouse(event);
    let newX = x - dragOffsetX;
    let newY = y - dragOffsetY;

    selectedIcon.setAttribute('x', newX);
    selectedIcon.setAttribute('y', newY);

    // Update data attributes for arrow attachment
    selectedIcon.setAttribute('data-shape-x', newX);
    selectedIcon.setAttribute('data-shape-y', newY);

    // Update the transform
    const width = parseFloat(selectedIcon.getAttribute('width')) || 100;
    const scale = width / 24;
    selectedIcon.setAttribute('transform', `translate(${newX}, ${newY}) scale(${scale}) rotate(${iconRotation})`);

    // Update frame containment for IconShape wrapper
    if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
        const iconShape = shapes.find(shape => shape.shapeName === 'icon' && shape.element === selectedIcon);
        if (iconShape) {
            iconShape.updateFrameContainment();
        }
    }

    // Update attached arrows during drag
    if (typeof updateAttachedArrows === 'function') {
        updateAttachedArrows(selectedIcon);
    }

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}

function stopDrag(event) {
    stopInteracting();
    document.removeEventListener('mouseup', stopDrag);
}

function startRotation(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedIcon) return;

    isRotatingIcon = true;
    console.log(selectedIcon)
    // Get icon center - calculate from current position like in image
    const iconX = parseFloat(selectedIcon.getAttribute('x'));
    const iconY = parseFloat(selectedIcon.getAttribute('y'));
    const iconWidth = parseFloat(selectedIcon.getAttribute('width'));
    const iconHeight = parseFloat(selectedIcon.getAttribute('height'));
    
    const centerX = iconX + iconWidth / 2;
    const centerY = iconY + iconHeight / 2;

    // Calculate initial mouse angle relative to icon center
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(event);
    
    startRotationMouseAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
    console.log('Start rotation mouse angle:', startRotationMouseAngle);
    startIconRotation = iconRotation;

    const svg = getSVGElement();
    if (svg) {
        svg.addEventListener('mousemove', rotateIcon);
        svg.style.cursor = 'grabbing';
    }
    document.addEventListener('mouseup', stopRotation);
}


function rotateIcon(event) {
    if (!isRotatingIcon || !selectedIcon) return;

    // Get icon dimensions and position - just like in imageTool.js
    const iconX = parseFloat(selectedIcon.getAttribute('x')) || 0;
    const iconY = parseFloat(selectedIcon.getAttribute('y')) || 0;
    const iconWidth = parseFloat(selectedIcon.getAttribute('width')) || 100;
    const iconHeight = parseFloat(selectedIcon.getAttribute('height')) || 100;
    
    // Calculate center based on current position and size (like image)
    const centerX = iconX + iconWidth / 2;
    const centerY = iconY + iconHeight / 2;

    // Calculate current mouse angle
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(event);
    
    const currentMouseAngle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI;
    const angleDiff = currentMouseAngle - startRotationMouseAngle;
    
    iconRotation = startIconRotation + angleDiff;
    iconRotation = iconRotation % 360;
    if (iconRotation < 0) iconRotation += 360;

    // Apply rotation transform with center at icon's local center (in scaled coordinates)
    const scale = iconWidth / 24;
    // The rotation center should be at the center of the scaled icon (12, 12 for a 24x24 icon)
    const localCenterX = iconWidth / 2 / scale; // This gives us 12 for a 100-width icon
    const localCenterY = iconHeight / 2 / scale; // This gives us 12 for a 100-height icon
    
    selectedIcon.setAttribute('transform', `translate(${iconX}, ${iconY}) scale(${scale}) rotate(${iconRotation}, ${localCenterX}, ${localCenterY})`);
    
    // Update data attribute for arrow attachment
    selectedIcon.setAttribute('data-shape-rotation', iconRotation);

    // Update attached arrows during rotation
    if (typeof updateAttachedArrows === 'function') {
        updateAttachedArrows(selectedIcon);
    }

    // Update the selection outline and anchors
    removeSelectionOutline();
    addSelectionOutline();
}
function stopRotation(event) {
    if (!isRotatingIcon) return;
    stopInteracting();
    isRotatingIcon = false;
    startRotationMouseAngle = null;
    startIconRotation = null;
    
    const svg = getSVGElement();
    if (svg) {
        svg.removeEventListener('mousemove', rotateIcon);
        svg.style.cursor = 'default';
    }
    document.removeEventListener('mouseup', stopRotation);
}

function stopInteracting() {
    // Store transform data before stopping interaction
    if (selectedIcon && (isDragging || isRotatingIcon || currentAnchor)) {
        const newPos = {
            x: parseFloat(selectedIcon.getAttribute('x')) || 0,
            y: parseFloat(selectedIcon.getAttribute('y')) || 0,
            width: parseFloat(selectedIcon.getAttribute('width')) || 100,
            height: parseFloat(selectedIcon.getAttribute('height')) || 100,
            rotation: iconRotation
        };
        
        // Get the original rotation from the stored start rotation or current rotation
        let originalRotation = iconRotation;
        if (isRotatingIcon && startIconRotation !== null) {
            originalRotation = startIconRotation;
        }
        
        const oldPos = {
            x: originalX,
            y: originalY,
            width: originalWidth,
            height: originalHeight,
            rotation: originalRotation
        };

        // Find the IconShape wrapper for frame tracking
        let iconShape = null;
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            iconShape = shapes.find(shape => shape.shapeName === 'icon' && shape.element === selectedIcon);
        }

        // Add frame information for undo tracking
        const oldPosWithFrame = {
            ...oldPos,
            parentFrame: draggedShapeInitialFrameIcon
        };
        const newPosWithFrame = {
            ...newPos,
            parentFrame: iconShape ? iconShape.parentFrame : null
        };

        // Only push transform action if something actually changed
        const stateChanged = newPos.x !== oldPos.x || newPos.y !== oldPos.y || 
                           newPos.width !== oldPos.width || newPos.height !== oldPos.height ||
                           newPos.rotation !== oldPos.rotation;
        const frameChanged = oldPosWithFrame.parentFrame !== newPosWithFrame.parentFrame;

        if (stateChanged || frameChanged) {
            pushTransformAction({
                type: 'icon',
                element: selectedIcon,
                restore: (pos) => {
                    selectedIcon.setAttribute('x', pos.x);
                    selectedIcon.setAttribute('y', pos.y);
                    selectedIcon.setAttribute('width', pos.width);
                    selectedIcon.setAttribute('height', pos.height);
                    const scale = pos.width / 24;
                    selectedIcon.setAttribute('transform', `translate(${pos.x}, ${pos.y}) scale(${scale}) rotate(${pos.rotation})`);
                    iconRotation = pos.rotation;
                    
                    // Update selection outline if icon is selected
                    if (selectedIcon) {
                        removeSelectionOutline();
                        addSelectionOutline();
                    }
                    
                    // Update data attributes for arrow attachment consistency
                    selectedIcon.setAttribute('data-shape-x', pos.x);
                    selectedIcon.setAttribute('data-shape-y', pos.y);
                    selectedIcon.setAttribute('data-shape-width', pos.width);
                    selectedIcon.setAttribute('data-shape-height', pos.height);
                    selectedIcon.setAttribute('data-shape-rotation', pos.rotation);
                    
                    // Update attached arrows
                    if (typeof updateAttachedArrows === 'function') {
                        updateAttachedArrows(selectedIcon);
                    }
                }
            }, oldPosWithFrame, newPosWithFrame);
        }

        // Handle frame containment changes after drag
        if (isDragging && iconShape) {
            const finalFrame = hoveredFrameIcon;
            
            // If shape moved to a different frame
            if (draggedShapeInitialFrameIcon !== finalFrame) {
                // Remove from initial frame
                if (draggedShapeInitialFrameIcon) {
                    draggedShapeInitialFrameIcon.removeShapeFromFrame(iconShape);
                }
                
                // Add to new frame
                if (finalFrame) {
                    finalFrame.addShapeToFrame(iconShape);
                }
                
                // Track the frame change for undo
                if (frameChanged) {
                    pushFrameAttachmentAction(finalFrame || draggedShapeInitialFrameIcon, iconShape, 
                        finalFrame ? 'attach' : 'detach', draggedShapeInitialFrameIcon);
                }
            } else if (draggedShapeInitialFrameIcon) {
                // Shape stayed in same frame, restore clipping
                draggedShapeInitialFrameIcon.restoreToFrame(iconShape);
            }
        }
        
        draggedShapeInitialFrameIcon = null;
    }

    // Clear frame highlighting
    if (hoveredFrameIcon) {
        hoveredFrameIcon.removeHighlight();
        hoveredFrameIcon = null;
    }

    isDragging = false;
    isRotatingIcon = false;
    
    const svg = getSVGElement();
    if (svg) {
        svg.removeEventListener('mousemove', dragIcon);
        svg.removeEventListener('mousemove', resizeIcon);
        svg.removeEventListener('mousemove', rotateIcon);
    }
    
    currentAnchor = null;
    startRotationMouseAngle = null;
    startIconRotation = null;

    // Update original values after interaction is complete
    if (selectedIcon) {
        originalX = parseFloat(selectedIcon.getAttribute('x')) || 0;
        originalY = parseFloat(selectedIcon.getAttribute('y')) || 0;
        originalWidth = parseFloat(selectedIcon.getAttribute('width')) || 100;
        originalHeight = parseFloat(selectedIcon.getAttribute('height')) || 100;
        
        // Update data attributes for arrow attachment consistency
        selectedIcon.setAttribute('data-shape-x', originalX);
        selectedIcon.setAttribute('data-shape-y', originalY);
        selectedIcon.setAttribute('data-shape-width', originalWidth);
        selectedIcon.setAttribute('data-shape-height', originalHeight);
        selectedIcon.setAttribute('data-shape-rotation', iconRotation);
        
        // Update attached arrows after interaction ends
        if (typeof updateAttachedArrows === 'function') {
            updateAttachedArrows(selectedIcon);
        }
    }
}

// Add delete functionality for icons
function deleteCurrentIcon() {
    if (selectedIcon) {
        // Find the IconShape wrapper
        let iconShape = null;
        if (typeof shapes !== 'undefined' && Array.isArray(shapes)) {
            iconShape = shapes.find(shape => shape.shapeName === 'icon' && shape.element === selectedIcon);
            if (iconShape) {
                const idx = shapes.indexOf(iconShape);
                if (idx !== -1) shapes.splice(idx, 1);
                
                // Remove the group (which contains the icon)
                if (iconShape.group && iconShape.group.parentNode) {
                    iconShape.group.parentNode.removeChild(iconShape.group);
                }
            }
        }
        
        // Fallback: if no IconShape wrapper found, remove the icon directly
        if (!iconShape && selectedIcon.parentNode) {
            selectedIcon.parentNode.removeChild(selectedIcon);
        }
        
        // Clean up any arrow attachments before deleting
        if (typeof cleanupAttachments === 'function') {
            cleanupAttachments(selectedIcon);
        }
        
        // Push delete action for undo
        if (iconShape) {
            pushDeleteAction(iconShape);
        }
        
        // Clean up selection
        removeSelectionOutline();
        selectedIcon = null;
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedIcon) {
        deleteCurrentIcon();
    }
});

export { handleMouseDownIcon, handleMouseMoveIcon, handleMouseUpIcon };