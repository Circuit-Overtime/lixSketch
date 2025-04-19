// selectionManager.js

class SelectionManager {
    constructor(svgElement, shapesArray) {
        this.svg = svgElement;
        this.shapes = shapesArray; // Reference to the main shapes array
        this.selectedShapes = []; // Use an array for potential multi-select later
        this.currentShape = null; // Keep for single-shape operations like resize/rotate
        this.isResizing = false;
        this.isRotating = false;
        this.isDragging = false;
        this.activeAnchorIndex = -1; // Store index instead of element
        this.startX = 0;
        this.startY = 0;
        this.lastX = 0; // Store last mouse position for delta calculation
        this.lastY = 0;
        this.rotationStartAngle = 0;
        // Offsets are less necessary if using delta movement, but keep startX/Y
    }

    // Helper to get SVG coordinates from a mouse event
    getSVGCoords(e) {
        const pt = this.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        // Ensure the CTM is available and valid
        const ctm = this.svg.getScreenCTM();
        if (!ctm) {
             console.error("SVG screen CTM is not available.");
             // Provide a fallback or default coordinate system if possible
             // For simplicity, returning clientX/Y might work in some basic cases
             // but won't account for SVG transforms, zoom, pan.
             // Returning null or throwing might be safer.
             return { x: e.clientX, y: e.clientY }; // Basic fallback
        }
        const svgP = pt.matrixTransform(ctm.inverse());
        return { x: svgP.x, y: svgP.y };
    }

     // Helper to find the shape object associated with an SVG element (like an anchor)
     findShapeForElement(element) {
         let current = element;
         while (current && current !== this.svg) {
             const parentGroup = current.parentNode;
             if (parentGroup && parentGroup.tagName.toLowerCase() === 'g') {
                 // Find the shape whose group matches the parent group
                 const foundShape = this.shapes.find(shape => shape.group === parentGroup);
                 if (foundShape) return foundShape;
             }
              // Optional: Check if element itself is the group (less common for clicks)
             if (current.tagName.toLowerCase() === 'g') {
                 const foundShape = this.shapes.find(shape => shape.group === current);
                 if (foundShape) return foundShape;
             }
             current = current.parentNode;
         }
         return null;
     }


    handleMouseDown(e) {
        // Ensure the selection tool is active in the main script
        // if (!isSelectionToolActive) return; // Assuming isSelectionToolActive is global/accessible

        const { x, y } = this.getSVGCoords(e);
        this.startX = x;
        this.startY = y;
        this.lastX = x; // Initialize last position
        this.lastY = y;
        this.isResizing = false;
        this.isRotating = false;
        this.isDragging = false;
        this.activeAnchorIndex = -1;

        const target = e.target;
        const targetShape = this.findShapeForElement(target); // Find shape associated with the clicked element's group


        // --- Check for Rotation Anchor ---
        if (target.classList.contains('rotate-anchor') && targetShape && targetShape.isSelected) {
             // Ensure targetShape has rotation capabilities if needed
             if (typeof targetShape.rotate === 'function') {
                 this.isRotating = true;
                 this.currentShape = targetShape; // Shape being rotated

                 // Rotation center calculation might need to be shape-specific
                 // Using centerX/centerY for Circle/Ellipse
                 const centerX = targetShape.centerX ?? (targetShape.x + targetShape.width / 2); // Fallback for rect-like
                 const centerY = targetShape.centerY ?? (targetShape.y + targetShape.height / 2);
                 const initialRotation = targetShape.rotation ?? 0; // Handle undefined rotation

                 this.rotationStartAngle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI - initialRotation;
                 e.stopPropagation(); // Prevent triggering drag/selection change
                 return;
             }
        }


        // --- Check for Resize Anchor ---
        if (target.classList.contains('anchor') && targetShape && targetShape.isSelected) {
            this.isResizing = true;
            this.activeAnchorIndex = parseInt(target.dataset.index);
            this.currentShape = targetShape; // Shape being resized
            e.stopPropagation(); // Prevent triggering drag/selection change
            return;
        }

        // --- Check for Shape Body Click ---
        // Iterate shapes in reverse draw order (topmost first) for accurate selection
        let clickedShape = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
             // Use the shape's own contains method
            if (typeof shape.contains === 'function' && shape.contains(x, y)) {
                clickedShape = shape;
                break; // Found the topmost shape
            }
        }

        // --- Handle Selection Logic ---
        const wasSelected = clickedShape ? clickedShape.isSelected : false;

        // If not holding Shift, deselect all shapes *unless* clicking an already selected shape
        if (!e.shiftKey) {
            if (!wasSelected) {
                 this.deselectAllShapes(); // Deselect previously selected shapes
            }
        }

        if (clickedShape) {
            // Toggle selection if Shift is held, otherwise select if not already selected
            if (e.shiftKey) {
                 if (wasSelected) {
                     this.deselectShape(clickedShape);
                 } else {
                     this.selectShape(clickedShape);
                 }
            } else {
                 // Select the shape (if it wasn't selected before, deselectAll already ran)
                 if (!wasSelected) {
                    this.selectShape(clickedShape);
                 }
            }

            // If the shape is now selected, prepare for dragging
            if (clickedShape.isSelected) {
                 this.isDragging = true;
                 this.currentShape = clickedShape; // Track potentially dragged shape
                 this.svg.style.cursor = 'grabbing';
                 // Start tracking last position for delta calculation in mouseMove
                 this.lastX = x;
                 this.lastY = y;
            }
        } else {
            // Clicked on empty space and not holding shift
            if (!e.shiftKey) {
                this.deselectAllShapes();
            }
             this.currentShape = null; // No shape is actively being interacted with
        }

        // Redraw shapes that changed selection state (could optimize further)
        this.redrawChangedShapes();
    }


    handleMouseMove(e) {
        // if (!isSelectionToolActive) return; // Optional check

        const { x, y } = this.getSVGCoords(e);
        const dx = x - this.lastX; // Calculate delta X
        const dy = y - this.lastY; // Calculate delta Y


        if (this.isResizing && this.currentShape) {
            // Resizing logic expects absolute coordinates
            this.currentShape.updatePosition(this.activeAnchorIndex, x, y);
        } else if (this.isRotating && this.currentShape) {
            // Rotation logic (adapt as needed for shape type)
            const centerX = this.currentShape.centerX ?? (this.currentShape.x + this.currentShape.width / 2);
            const centerY = this.currentShape.centerY ?? (this.currentShape.y + this.currentShape.height / 2);
            const currentAngle = Math.atan2(y - centerY, x - centerX) * 180 / Math.PI;
            this.currentShape.rotate(currentAngle - this.rotationStartAngle);

        } else if (this.isDragging) { // Check isDragging flag

            // --- Correct Dragging Logic ---
            // Move all selected shapes by the calculated delta
             if (dx !== 0 || dy !== 0) { // Only move if there's a change
                 this.selectedShapes.forEach(shape => {
                     if (typeof shape.move === 'function') {
                         shape.move(dx, dy); // Use the shape's move method
                     }
                 });
             }
             // --- End Correct Dragging Logic ---
        } else {
             // Update cursor based on hover (optional)
             // Could check if hovering over an anchor/rotate handle/shape body
             this.updateCursorOnHover(x, y);
        }


        // Update last position for the next mouse move event
        this.lastX = x;
        this.lastY = y;
    }


    handleMouseUp(e) {
        // if (!isSelectionToolActive) return; // Optional check

        if (this.isDragging) {
            this.svg.style.cursor = this.selectedShapes.length > 0 ? 'grab' : 'default'; // Reset cursor
        } else if (this.isResizing || this.isRotating) {
            this.svg.style.cursor = 'default'; // Or 'grab' if shape remains selected
            if (this.currentShape && this.currentShape.isSelected) {
                 this.svg.style.cursor = 'grab';
            }
        }


        this.isResizing = false;
        this.isRotating = false;
        this.isDragging = false;
        this.activeAnchorIndex = -1;
        this.currentShape = null; // Clear the shape actively being manipulated
        // startX/Y, lastX/Y don't need reset here, they get set on next mousedown
    }

    // --- Selection Management Methods ---

    selectShape(shape) {
        if (!shape || this.selectedShapes.includes(shape)) return;
        this.selectedShapes.push(shape);
        shape.isSelected = true;
        // shape.draw(); // Handled by redrawChangedShapes
         this.updateCursorBasedOnSelection();
    }

    deselectShape(shape) {
        if (!shape) return;
        const index = this.selectedShapes.indexOf(shape);
        if (index > -1) {
            this.selectedShapes.splice(index, 1);
            shape.isSelected = false;
            // shape.draw(); // Handled by redrawChangedShapes
             this.updateCursorBasedOnSelection();
        }
    }

    deselectAllShapes() {
        let changed = false;
        this.selectedShapes.forEach(shape => {
            if (shape.isSelected) {
                shape.isSelected = false;
                changed = true;
            }
        });
        this.selectedShapes = [];
        if (changed) {
             // this.redrawChangedShapes(); // Called by the caller if needed
             this.updateCursorBasedOnSelection();
        }
    }

    redrawChangedShapes() {
         // Simple approach: redraw all shapes
         // Optimization: track which shapes changed and only redraw them
         this.shapes.forEach(shape => {
             if (typeof shape.draw === 'function') {
                 shape.draw();
             }
         });
    }

     updateCursorBasedOnSelection() {
         if (this.isDragging) {
             this.svg.style.cursor = 'grabbing';
         } else if (this.selectedShapes.length > 0) {
             this.svg.style.cursor = 'grab';
         } else {
             this.svg.style.cursor = 'default';
         }
     }

     updateCursorOnHover(x, y) {
        if (this.isDragging || this.isResizing || this.isRotating) return; // Don't change cursor during manipulation

        // Check anchors/rotate handles first (more specific)
        for (const shape of this.selectedShapes) {
             if (shape.rotationAnchor) {
                 // Basic bounding box check for rotation anchor - refine if needed
                 const rotationHandleSize = 12; // Example size
                 const anchorPos = shape.getRotationAnchorPosition(); // Assume this method exists or calculate it
                 if (anchorPos && x >= anchorPos.x - rotationHandleSize/2 && x <= anchorPos.x + rotationHandleSize/2 &&
                     y >= anchorPos.y - rotationHandleSize/2 && y <= anchorPos.y + rotationHandleSize/2) {
                    this.svg.style.cursor = 'crosshair'; // Or a specific rotation cursor
                    return;
                 }
             }
             for (let i = 0; i < shape.anchors.length; i++) {
                 const anchor = shape.anchors[i];
                 // Check anchor bounds (use getBBox or calculate from attributes)
                 const anchorRect = anchor.getBBox ? anchor.getBBox() : {
                     x: parseFloat(anchor.getAttribute('x')),
                     y: parseFloat(anchor.getAttribute('y')),
                     width: parseFloat(anchor.getAttribute('width')),
                     height: parseFloat(anchor.getAttribute('height')),
                 };
                 if (x >= anchorRect.x && x <= anchorRect.x + anchorRect.width &&
                     y >= anchorRect.y && y <= anchorRect.y + anchorRect.height) {
                    // Set cursor based on anchor index (from your Circle class)
                     const anchorDirections = { 0: 'nwse', 1: 'nesw', 2: 'nesw', 3: 'nwse', 4: 'ns', 5: 'ns', 6: 'ew', 7: 'ew' };
                     this.svg.style.cursor = (anchorDirections[i] || 'pointer') + '-resize';
                     return;
                 }
             }
        }

        // Check shape body hover
        let hoveredShape = null;
         for (let i = this.shapes.length - 1; i >= 0; i--) {
             const shape = this.shapes[i];
             if (typeof shape.contains === 'function' && shape.contains(x, y)) {
                 hoveredShape = shape;
                 break;
             }
         }

         if (hoveredShape) {
             this.svg.style.cursor = hoveredShape.isSelected ? 'grab' : 'pointer';
         } else {
              this.svg.style.cursor = 'default';
         }
     }


    // Method to update the internal shapes array if it changes externally
    setShapes(shapesArray) {
        this.shapes = shapesArray;
        // Optionally, reconcile selectedShapes if the array changes drastically
        this.selectedShapes = this.selectedShapes.filter(selShape => this.shapes.includes(selShape));
         this.redrawChangedShapes(); // Redraw to reflect potential changes
    }
}

export { SelectionManager };