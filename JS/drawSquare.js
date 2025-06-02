let isDrawingSquare = false;
let isDraggingShape = false;
let isResizingShape = false;
let isRotatingShape = false;
let resizingAnchorIndex = null;
let startRotationMouseAngle = 0;
let startShapeRotation = 0;

const rc = rough.svg(svg); // Initialize RoughSVG with your SVG element
let startX, startY;
let squareStrokecolor = "#fff";
let squareBackgroundColor = "transparent";
let squareFillStyleValue = "none";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";
let dragOldPos = null; // Used for drag/resize/rotate/options transform actions
let oldOptions = null; // Not currently used in the provided snippets for options tracking, relying on dragOldPos structure
let SquarecolorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptionsSquare = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");
let lastMousePos = null; // Keep track of last mouse pos for paste location

import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';


class Rectangle {
    constructor(x, y, width, height, options = {}) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.options = {
            roughness: 1.5,
            stroke: squareStrokecolor,
            strokeWidth: squareStrokeThicknes,
            fill: squareBackgroundColor,
            fillStyle: squareFillStyleValue,
            strokeDasharray: squareOutlineStyle === "dashed" ? "10,10" : (squareOutlineStyle === "dotted" ? "2,8" : ""),
            ...options
        };
        this.element = null;
        this.isSelected = false;
        this.rotation = 0;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.anchors = [];
        this.rotationAnchor = null;
        this.selectionPadding = 8;
        this.selectionOutline = null;
        this.shapeName = 'rectangle';
        this.draw(); // Initial draw
         // Add group to SVG on creation
         if (!this.group.parentNode) {
             svg.appendChild(this.group);
         }
    }

    draw() {
        // Clear existing roughjs element and selection elements from the group
        // Keep the group element itself
        const childrenToRemove = [];
        for (let i = 0; i < this.group.children.length; i++) {
            const child = this.group.children[i];
            if (child !== this.element) { // Keep the roughjs element if it exists (e.g., during update)
                 childrenToRemove.push(child);
            }
        }
         childrenToRemove.forEach(child => this.group.removeChild(child));

        // If element exists from a previous draw, remove it before creating new roughjs element
        if (this.element && this.element.parentNode === this.group) {
             this.group.removeChild(this.element);
             this.element = null;
        }

        // Create the roughjs rectangle. Draw it at (0,0) because the group will be translated.
        const roughRect = rc.rectangle(0, 0, this.width, this.height, this.options);
        this.element = roughRect;
        this.group.appendChild(roughRect);

        // Apply translation and rotation transformation to the group
        // The group origin (0,0) will be translated to this.x, this.y
        // The rotation will happen around the shape's center relative to the group's origin (0,0)
        const rotateCenterX = this.width / 2;
        const rotateCenterY = this.height / 2;
        this.group.setAttribute('transform', `translate(${this.x}, ${this.y}) rotate(${this.rotation}, ${rotateCenterX}, ${rotateCenterY})`);


        if (this.isSelected) {
            this.addAnchors();
        }

        // Ensure the group is in the SVG (should be already done in constructor, but belt-and-suspenders)
        if (!this.group.parentNode) {
             svg.appendChild(this.group);
        }
    }

    getRotatedCursor(direction, angle) {
        const directions = ['ns', 'nesw', 'ew', 'nwse'];

        // Normalize angle to be between 0 and 360
        angle = angle % 360;
        if (angle < 0) angle += 360;

        // Map anchor index (string or number) to base direction
        const baseDirectionMap = {
            '0': 'nwse', '1': 'nesw', // Corners
            '2': 'nesw', '3': 'nwse', // Corners
            '4': 'ns',   '5': 'ns',     // Vertical sides
            '6': 'ew',   '7': 'ew'      // Horizontal sides
        };
        const baseDirection = baseDirectionMap[direction];

        // Determine the effective angle based on the base direction and current shape rotation
        let effectiveAngle = angle; // Start with shape's rotation

        // Adjust effective angle based on the base direction's inherent orientation
        if (baseDirection === 'nesw') {
            effectiveAngle += 45;
        } else if (baseDirection === 'ew') {
            effectiveAngle += 90;
        } else if (baseDirection === 'nwse') {
            effectiveAngle += 135;
        }
        // 'ns' corresponds to 0 degrees, no addition needed

        // Normalize effectiveAngle to 0-360 range
        effectiveAngle = effectiveAngle % 360;
        if (effectiveAngle < 0) effectiveAngle += 360;

        // Find the index in the directions array based on 45-degree increments
        // 0-45 -> ns, 45-90 -> nesw, 90-135 -> ew, 135-180 -> nwse
        // The pattern repeats every 180 degrees.
        const index = Math.round(effectiveAngle / 45) % 4; // Modulo 4 because directions has 4 elements

        // Adjust index mapping based on how the standard cursors align with angles
        // ns -> 0/180, nesw -> 45/225, ew -> 90/270, nwse -> 135/315
         let finalIndex;
         if (effectiveAngle >= 337.5 || effectiveAngle < 22.5) finalIndex = 0; // ~0 ns
         else if (effectiveAngle >= 22.5 && effectiveAngle < 67.5) finalIndex = 1; // ~45 nesw
         else if (effectiveAngle >= 67.5 && effectiveAngle < 112.5) finalIndex = 2; // ~90 ew
         else if (effectiveAngle >= 112.5 && effectiveAngle < 157.5) finalIndex = 3; // ~135 nwse
         else if (effectiveAngle >= 157.5 && effectiveAngle < 202.5) finalIndex = 0; // ~180 ns
         else if (effectiveAngle >= 202.5 && effectiveAngle < 247.5) finalIndex = 1; // ~225 nesw
         else if (effectiveAngle >= 247.5 && effectiveAngle < 292.5) finalIndex = 2; // ~270 ew
         else if (effectiveAngle >= 292.5 && effectiveAngle < 337.5) finalIndex = 3; // ~315 nwse
         else finalIndex = 0; // Default

        return directions[finalIndex];
    }


    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this;

        // Coordinates of anchor and outline positions relative to the group's origin (0,0),
        // which corresponds to the shape's top-left (this.x, this.y) in SVG space.
        const expandedX = -this.selectionPadding; // Relative X
        const expandedY = -this.selectionPadding; // Relative Y
        const expandedWidth = this.width + 2 * this.selectionPadding;
        const expandedHeight = this.height + 2 * this.selectionPadding;

        const positions = [
            { x: expandedX, y: expandedY }, // Top-Left (0)
            { x: expandedX + expandedWidth, y: expandedY }, // Top-Right (1)
            { x: expandedX, y: expandedY + expandedHeight }, // Bottom-Left (2)
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight }, // Bottom-Right (3)
            { x: expandedX + expandedWidth / 2, y: expandedY }, // Top-Middle (4)
            { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight }, // Bottom-Middle (5)
            { x: expandedX, y: expandedHeight / 2 + expandedY }, // Left-Middle (6)
            { x: expandedX + expandedWidth, y: expandedHeight / 2 + expandedY } // Right-Middle (7)
        ];

        const outlinePoints = [
            [positions[0].x, positions[0].y],
            [positions[1].x, positions[1].y],
            [positions[3].x, positions[3].y],
            [positions[2].x, positions[2].y],
            [positions[0].x, positions[0].y]
        ];

        // Remove existing anchors and outline before adding new ones
        // These are children of the group, so we can remove them directly
        this.anchors.forEach(anchor => {
             if (anchor.parentNode === this.group) {
                 this.group.removeChild(anchor);
             }
         });
          if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
             this.group.removeChild(this.rotationAnchor);
         }
          if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
             this.group.removeChild(this.selectionOutline);
         }

        this.anchors = [];

        const anchorDirections = {
            0: 'nwse', // TL
            1: 'nesw', // TR
            2: 'nesw', // BL (Diagonal cursor flips)
            3: 'nwse', // BR (Diagonal cursor flips)
            4: 'ns',   // TM
            5: 'ns',   // BM
            6: 'ew',   // LM
            7: 'ew'    // RM
        };


        positions.forEach((pos, i) => {
            const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

            // Anchor position is relative to the group's origin (shape's top-left)
            anchor.setAttribute('x', pos.x - anchorSize / 2);
            anchor.setAttribute('y', pos.y - anchorSize / 2);
            anchor.setAttribute('width', anchorSize);
            anchor.setAttribute('height', anchorSize);
            anchor.setAttribute('class', 'anchor'); // Add anchor class
            anchor.setAttribute('data-index', i); // Store anchor index
            anchor.setAttribute('fill', '#121212');
            anchor.setAttribute('stroke', '#5B57D1');
            anchor.setAttribute('stroke-width', anchorStrokeWidth);
            anchor.setAttribute('style', 'pointer-events: all;'); // Make it clickable

            anchor.addEventListener('mouseover', function () {
                const index = this.getAttribute('data-index');
                const baseDirection = anchorDirections[index];
                // Pass the shape's rotation to get the correct cursor
                const rotatedCursor = self.getRotatedCursor(index, self.rotation); // Pass index directly
                svg.style.cursor = rotatedCursor + '-resize';
            });

            anchor.addEventListener('mouseout', function () {
                 // Only revert cursor if no interaction is active
                 if (!isResizingShape && !isDraggingShape && !isRotatingShape) {
                     svg.style.cursor = 'default';
                 }
            });

            this.group.appendChild(anchor);
            this.anchors[i] = anchor;
        });

        // Rotation anchor position relative to the group's origin (shape's top-left)
        const rotationAnchorPos = { x: expandedX + expandedWidth / 2, y: expandedY - 30 };
        this.rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
        this.rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
        this.rotationAnchor.setAttribute('r', 8);
        this.rotationAnchor.setAttribute('class', 'rotate-anchor'); // Add rotation anchor class
        this.rotationAnchor.setAttribute('fill', '#121212');
        this.rotationAnchor.setAttribute('stroke', '#5B57D1');
        this.rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
        this.rotationAnchor.setAttribute('style', 'pointer-events: all;'); // Make it clickable
        this.group.appendChild(this.rotationAnchor);

        this.rotationAnchor.addEventListener('mouseover', function () {
             // Only set cursor if no interaction is active
             if (!isResizingShape && !isDraggingShape && !isRotatingShape) {
                 svg.style.cursor = 'grab';
             }
        });
        this.rotationAnchor.addEventListener('mouseout', function () {
            if (!isResizingShape && !isDraggingShape && !isRotatingShape) {
                svg.style.cursor = 'default';
            }
        });

        const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        outline.setAttribute('points', pointsAttr);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#5B57D1');
        outline.setAttribute('stroke-width', 1.5);
        outline.setAttribute('stroke-dasharray', '4 2');
        outline.setAttribute('style', 'pointer-events: none;'); // Outline itself is not clickable
        this.group.appendChild(outline);
        this.selectionOutline = outline;

        // Show relevant sidebar
        disableAllSideBars();
        squareSideBar.classList.remove("hidden");

         // Update sidebar values to reflect selected shape's properties
         this.updateSidebar();
    }

    removeSelection() {
        // Remove selection elements (anchors, outline, rotation anchor) from the group
        this.anchors.forEach(anchor => {
             if (anchor.parentNode === this.group) {
                 this.group.removeChild(anchor);
             }
         });
         if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
            this.group.removeChild(this.rotationAnchor);
         }
         if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
         }
        this.anchors = [];
        this.rotationAnchor = null;
        this.selectionOutline = null;
        this.isSelected = false;
        // Hide sidebar when shape is deselected (handled in mouse down/up)
    }

    contains(x, y) {
         if (!this.element) return false; // Cannot contain if not drawn

        // Get the inverse of the group's CTM to transform the click point from SVG space
        // into the group's local coordinate system (where the rectangle is at 0,0).
        const CTM = this.group.getCTM();
        if (!CTM) return false; // Group not attached or visible
        const inverseCTM = CTM.inverse();

        const svgPoint = svg.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;

        // Transform the click point into the group's local coordinates
        const transformedPoint = svgPoint.matrixTransform(inverseCTM);

        // Check if the transformed point is within the non-rotated rectangle bounds at (0,0)
        // Add a small tolerance (e.g., 1px) for easier clicking on thin shapes
        const tolerance = 1;
        return transformedPoint.x >= -tolerance && transformedPoint.x <= this.width + tolerance &&
               transformedPoint.y >= -tolerance && transformedPoint.y <= this.height + tolerance;
    }

     // Helper to check if a point is near an anchor
     isNearAnchor(x, y) {
         if (!this.isSelected) return null;
         const buffer = 10; // Click tolerance
         const anchorSize = 10; // Size of the anchor rect

         // Iterate through anchors
         for (let i = 0; i < this.anchors.length; i++) {
             const anchor = this.anchors[i];
             // Get the center of the anchor in its local coordinates (relative to group origin)
             const anchorLocalX = parseFloat(anchor.getAttribute('x')) + anchorSize / 2;
             const anchorLocalY = parseFloat(anchor.getAttribute('y')) + anchorSize / 2;

             // Transform the anchor center point from local coordinates to SVG coordinates using the group's CTM
             const svgPoint = svg.createSVGPoint();
             svgPoint.x = anchorLocalX;
             svgPoint.y = anchorLocalY;
             const transformedPoint = svgPoint.matrixTransform(this.group.getCTM());

             // Check if the mouse click (x,y) is within the anchor bounding box + buffer in SVG coordinates
             const anchorLeft = transformedPoint.x - anchorSize/2 - buffer;
             const anchorRight = transformedPoint.x + anchorSize/2 + buffer;
             const anchorTop = transformedPoint.y - anchorSize/2 - buffer;
             const anchorBottom = transformedPoint.y + anchorSize/2 + buffer;

             if (x >= anchorLeft && x <= anchorRight && y >= anchorTop && y <= anchorBottom) {
                 return { type: 'resize', index: i };
             }
         }

         // Check rotation anchor
         if (this.rotationAnchor) {
             // Get the center of the rotation anchor in its local coordinates (relative to group origin)
             const rotateAnchorLocalX = parseFloat(this.rotationAnchor.getAttribute('cx'));
             const rotateAnchorLocalY = parseFloat(this.rotationAnchor.getAttribute('cy'));

             // Transform the rotation anchor center point from local coordinates to SVG coordinates using the group's CTM
             const svgPoint = svg.createSVGPoint();
             svgPoint.x = rotateAnchorLocalX;
             svgPoint.y = rotateAnchorLocalY;
             const transformedPoint = svgPoint.matrixTransform(this.group.getCTM());

             const rotateAnchorRadius = parseFloat(this.rotationAnchor.getAttribute('r'));

             // Check if the mouse click (x,y) is within the rotation anchor circle + buffer
             const distSq = (x - transformedPoint.x)**2 + (y - transformedPoint.y)**2;
             if (distSq <= (rotateAnchorRadius + buffer)**2) {
                 return { type: 'rotate' };
             }
         }

         return null;
     }


    move(dx, dy) {
        // Update the shape's position (non-rotated bounding box top-left)
        this.x += dx;
        this.y += dy;
        // Drawing will apply the group transform based on the new x, y
    }

    updatePosition(anchorIndex, newMouseX, newMouseY) {
        // Convert the new mouse coordinates (in SVG space) into the shape's
        // local coordinate system (where the non-rotated shape is at 0,0).
        const CTM = this.group.getCTM();
        if (!CTM) return; // Should not happen if group is in SVG
        const inverseCTM = CTM.inverse();

        const svgPoint = svg.createSVGPoint();
        svgPoint.x = newMouseX;
        svgPoint.y = newMouseY;

        // This point represents the mouse position transformed back into the
        // coordinate space of the *non-rotated* shape's top-left corner.
        const transformedPoint = svgPoint.matrixTransform(inverseCTM);

        let oldX = 0; // Shape's current left edge in local coords (always 0)
        let oldY = 0; // Shape's current top edge in local coords (always 0)
        let oldWidth = this.width;
        let oldHeight = this.height;

        let newLocalX = 0; // New left edge in local coords
        let newLocalY = 0; // New top edge in local coords
        let newWidth = oldWidth;
        let newHeight = oldHeight;

        // Update newLocalX, newLocalY, newWidth, newHeight based on the anchor index
        // This logic determines the new bounds in the shape's local, non-rotated space.
        switch (anchorIndex) {
            case 0: // Top-Left
                newLocalX = transformedPoint.x;
                newLocalY = transformedPoint.y;
                newWidth = oldWidth - newLocalX;
                newHeight = oldHeight - newLocalY;
                break;
            case 1: // Top-Right
                newLocalY = transformedPoint.y;
                newWidth = transformedPoint.x - oldX;
                newHeight = oldHeight - newLocalY;
                break;
            case 2: // Bottom-Left
                newLocalX = transformedPoint.x;
                newWidth = oldWidth - newLocalX;
                newHeight = transformedPoint.y - oldY;
                break;
            case 3: // Bottom-Right
                newWidth = transformedPoint.x - oldX;
                newHeight = transformedPoint.y - oldY;
                break;
            case 4: // Top-Middle
                newLocalY = transformedPoint.y;
                newHeight = oldHeight - newLocalY;
                break;
            case 5: // Bottom-Middle
                newHeight = transformedPoint.y - oldY;
                break;
            case 6: // Left-Middle
                newLocalX = transformedPoint.x;
                newWidth = oldWidth - newLocalX;
                break;
            case 7: // Right-Middle
                newWidth = transformedPoint.x - oldX;
                break;
        }

        // Handle negative dimensions: adjust the shape's (this.x, this.y) and make dimensions positive.
        // This logic updates the shape's non-rotated bounding box representation.
        if (newWidth < 0) {
            this.x += newLocalX + newWidth; // Move x by the (negative) new width plus the old edge offset
            this.width = Math.abs(newWidth);
        } else {
             this.x += newLocalX; // Move x by the new edge offset from the old edge (0)
             this.width = newWidth;
        }

        if (newHeight < 0) {
            this.y += newLocalY + newHeight; // Move y by the (negative) new height plus the old edge offset
            this.height = Math.abs(newHeight);
        } else {
            this.y += newLocalY; // Move y by the new edge offset from the old edge (0)
            this.height = newHeight;
        }

        // No need to call draw() here, mousemove handler calls it after updating state
    }

    rotate(angle) {
         // Normalize angle
        angle = angle % 360;
        if (angle < 0) angle += 360;
        this.rotation = angle;
        // No need to call draw() here, mousemove handler calls it after updating state
    }

     // Method to update the sidebar based on the shape's current options
    updateSidebar() {
        // Assuming sidebar elements are globally accessible or passed
        // Update color pickers
        SquarecolorOptions.forEach(span => {
            const color = span.getAttribute("data-id");
            if (color === this.options.stroke) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });
        backgroundColorOptionsSquare.forEach(span => {
             const color = span.getAttribute("data-id");
            if (color === this.options.fill) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });

        // Update fill style
        fillStyleOptions.forEach(span => {
            const style = span.getAttribute("data-id");
            if (style === this.options.fillStyle) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
             }
        });

        // Update stroke thickness
        squareStrokeThicknessValue.forEach(span => {
             const thickness = parseInt(span.getAttribute("data-id"));
            if (thickness === this.options.strokeWidth) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
             }
        });

        // Update outline style
        squareOutlineStyleValue.forEach(span => {
            const style = span.getAttribute("data-id");
            let currentStyle = "solid";
            if (this.options.strokeDasharray === "10,10") currentStyle = "dashed";
            else if (this.options.strokeDasharray === "2,8") currentStyle = "dotted";

            if (style === currentStyle) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });
    }
}

function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'rectangle') {
        const idx = shapes.indexOf(currentShape);
        if (idx !== -1) shapes.splice(idx, 1);
        if (currentShape.group.parentNode) {
            currentShape.group.parentNode.removeChild(currentShape.group);
        }
        pushDeleteAction(currentShape); // Assuming this handles the undo data
        currentShape = null;
        disableAllSideBars(); // Hide sidebar after deleting
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && currentShape && currentShape.shapeName === 'rectangle') {
        deleteCurrentShape();
    }
});

const handleMouseDown = (e) => {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    if (isSquareToolActive) {
        startX = mouseX;
        startY = mouseY;
        isDrawingSquare = true;

        // Deselect any currently selected shape
        if (currentShape) {
            currentShape.removeSelection();
            currentShape = null;
            disableAllSideBars();
        }

        let initialOptions = {
            stroke: squareStrokecolor,
            fill: squareBackgroundColor,
            fillStyle: squareFillStyleValue,
            strokeWidth: squareStrokeThicknes,
        };
        if (squareOutlineStyle === "dashed") {
            initialOptions.strokeDasharray = "10,10";
        } else if (squareOutlineStyle === "dotted") {
            initialOptions.strokeDasharray = "2,8";
        } else {
            initialOptions.strokeDasharray = "";
        }

         // Create the shape instance with initial position and dimensions (0,0)
         // The draw method will handle placing the group correctly.
        currentShape = new Rectangle(startX, startY, 0, 0, initialOptions);


    } else if (isSelectionToolActive) {
        let clickedOnShape = false;

        // Check if clicked on the current shape's resize anchors or rotation anchor
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
            if (anchorInfo) {
                 dragOldPos = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; // Save state before resize/rotate
                if (anchorInfo.type === 'resize') {
                    isResizingShape = true;
                    resizingAnchorIndex = anchorInfo.index;
                } else if (anchorInfo.type === 'rotate') {
                    isRotatingShape = true;

                    // Get the center of the shape in SVG coordinates
                    const CTM = currentShape.group.getCTM();
                    if (CTM) {
                        // Transform the shape's center from local (width/2, height/2) to SVG coords
                        const svgPoint = svg.createSVGPoint();
                        svgPoint.x = currentShape.width / 2;
                        svgPoint.y = currentShape.height / 2;
                        const centerSVG = svgPoint.matrixTransform(CTM);

                        // Calculate initial angle from shape center to mouse position in SVG coords
                        startRotationMouseAngle = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;
                        startShapeRotation = currentShape.rotation;
                    } else {
                        // Fallback if CTM is not available (shape not in DOM?)
                         isRotatingShape = false; // Cancel rotation
                         console.warn("Could not get CTM for rotation.");
                    }
                }
                clickedOnShape = true; // Treat anchor click as clicking on the shape
            } else if (currentShape.contains(mouseX, mouseY)) {
                 // Clicked inside the currently selected shape but not on anchors
                 isDraggingShape = true;
                 dragOldPos = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; // Save state before drag
                 startX = mouseX; // Store mouse start for drag delta
                 startY = mouseY;
                 clickedOnShape = true;
             }
        }

        // If not clicking on the selected shape/anchors, check if clicking on any other shape
        if (!clickedOnShape) {
            let shapeToSelect = null;
            // Iterate backwards to select the top-most shape
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape.shapeName === 'rectangle' && shape.contains(mouseX, mouseY)) {
                    shapeToSelect = shape;
                    break; // Found the top-most shape
                }
            }

            // Deselect current shape if a different shape is clicked or empty space is clicked
            if (currentShape && currentShape !== shapeToSelect) {
                 currentShape.removeSelection();
                 currentShape = null;
                 disableAllSideBars();
            }

            // Select the new shape if one was found
            if (shapeToSelect) {
                currentShape = shapeToSelect;
                currentShape.isSelected = true;
                currentShape.draw(); // Redraw with selection handles
                isDraggingShape = true; // Start dragging the newly selected shape
                dragOldPos = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; // Save state before drag
                startX = mouseX; // Store mouse start for drag delta
                startY = mouseY;
                clickedOnShape = true; // Shape is now selected and potentially dragged
            }
        }

        // If clicked nowhere, ensure nothing is selected
        if (!clickedOnShape && currentShape) {
             currentShape.removeSelection();
             currentShape = null;
             disableAllSideBars();
        }
    }
};

const handleMouseMove = (e) => {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;

    const svgRect = svg.getBoundingClientRect();
     // Store clientX/Y for paste location logic
    lastMousePos = {
        x: e.clientX - svgRect.left, // Mouse position relative to SVG viewport client area
        y: e.clientY - svgRect.top
    };

    if (isDrawingSquare && isSquareToolActive && currentShape) {
        // Update dimensions and potentially position (x,y) based on mouse position relative to start
        // The draw method handles the group transform based on the updated x, y, width, height.
        let width = mouseX - startX;
        let height = mouseY - startY;

        // Adjust x, y, width, height based on drawing direction
        currentShape.x = width < 0 ? startX + width : startX;
        currentShape.y = height < 0 ? startY + height : startY;
        currentShape.width = Math.abs(width);
        currentShape.height = Math.abs(height);

        currentShape.draw();
    } else if (isDraggingShape && currentShape && currentShape.isSelected) {
        const dx = mouseX - startX;
        const dy = mouseY - startY;
        currentShape.move(dx, dy); // Updates currentShape.x and currentShape.y
        startX = mouseX; // Update start pos for next move event
        startY = mouseY;
        currentShape.draw(); // Redraw to update position on screen via group transform
    } else if (isResizingShape && currentShape && currentShape.isSelected && resizingAnchorIndex !== null) {
        currentShape.updatePosition(resizingAnchorIndex, mouseX, mouseY); // Updates x, y, width, height
        currentShape.draw(); // Redraw to update size and anchors
        // Cursor is handled by anchor mouseover/out and mouseup
    } else if (isRotatingShape && currentShape && currentShape.isSelected) {
        // Get the center of the shape in SVG coordinates
        const CTM = currentShape.group.getCTM();
        if (CTM) {
             // Transform the shape's center from local (width/2, height/2) to SVG coords
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = currentShape.width / 2;
            svgPoint.y = currentShape.height / 2;
            const centerSVG = svgPoint.matrixTransform(CTM);

            // Calculate current angle from shape center to mouse position
            const currentRotationMouseAngle = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;

            // Calculate angle difference and apply to shape rotation
            const angleDiff = currentRotationMouseAngle - startRotationMouseAngle;
            let newRotation = startShapeRotation + angleDiff;

            // Optional: Snap to 15 degree increments
             const snapAngle = 15;
             if (e.shiftKey) { // Example: hold shift to snap
                  newRotation = Math.round(newRotation / snapAngle) * snapAngle;
             }

            currentShape.rotate(newRotation); // Updates currentShape.rotation
            currentShape.draw(); // Redraw to update rotation via group transform

             svg.style.cursor = 'grabbing'; // Indicate grabbing while rotating
        } else {
             // Should not happen if isRotatingShape is true, but good defensive check
             isRotatingShape = false;
        }
    } else if (isSelectionToolActive && !isDrawingSquare && currentShape && currentShape.isSelected) {
         // If hovering over anchors/rotation handle while selected, update cursor
          const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
           if (anchorInfo) {
               if (anchorInfo.type === 'resize') {
                   const baseDirection = anchorInfo.index; // Pass index
                   const rotatedCursor = currentShape.getRotatedCursor(baseDirection, currentShape.rotation);
                   svg.style.cursor = rotatedCursor + '-resize';
               } else if (anchorInfo.type === 'rotate') {
                    svg.style.cursor = 'grab';
               }
           } else if (currentShape.contains(mouseX, mouseY)) {
               // Hovering over shape body
               svg.style.cursor = 'move';
           } else {
               // Hovering over empty space, shape is selected but not hovered directly
                svg.style.cursor = 'default';
           }
     } else if (isSelectionToolActive && !isDrawingSquare && !isDraggingShape && !isResizingShape && !isRotatingShape) {
         // Check if hovering over any shape when no interaction is active
         let hoveredShape = null;
         for (let i = shapes.length - 1; i >= 0; i--) {
             const shape = shapes[i];
             if (shape.shapeName === 'rectangle' && shape.contains(mouseX, mouseY)) {
                 hoveredShape = shape;
                 break;
             }
         }
         if (hoveredShape) {
             svg.style.cursor = 'pointer'; // Indicate selectable
         } else {
             svg.style.cursor = 'default'; // Default cursor over empty space
         }
    }
};

const handleMouseUp = (e) => {
    if (isDrawingSquare && currentShape) {
        // Finalize shape drawing
        if (currentShape.width === 0 || currentShape.height === 0) {
            // Remove the shape group from SVG if it has zero dimensions
            if (currentShape.group.parentNode) {
                currentShape.group.parentNode.removeChild(currentShape.group);
            }
            currentShape = null; // Do not add to shapes array if invalid
        } else {
            shapes.push(currentShape);
            pushCreateAction(currentShape); // Push create action to undo stack
            // Do NOT select or redraw with selection handles here
            // currentShape.isSelected = true;
            // currentShape.draw();
        }
    }

    // For drag, resize, rotate: push transform action if state changed
    if ((isDraggingShape || isResizingShape || isRotatingShape) && dragOldPos && currentShape) {
        const newPos = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation };
         // Check if the shape's state actually changed significantly
        const stateChanged = dragOldPos.x !== newPos.x || dragOldPos.y !== newPos.y ||
                             dragOldPos.width !== newPos.width || dragOldPos.height !== newPos.height ||
                             dragOldPos.rotation !== newPos.rotation;

        if (stateChanged) {
             pushTransformAction(currentShape, dragOldPos, newPos);
        }
        dragOldPos = null; // Reset old position after action
    }

    // Reset interaction flags
    isDrawingSquare = false;
    isDraggingShape = false;
    isResizingShape = false;
    isRotatingShape = false;
    resizingAnchorIndex = null;
    startRotationMouseAngle = 0;
    startShapeRotation = 0;

    // Ensure cursor is default after interaction ends
    svg.style.cursor = 'default';
};

svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);
// Listen to mouseup on document as well, in case the mouse leaves the SVG
document.addEventListener('mouseup', handleMouseUp);


SquarecolorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options }); // Push old options
            squareStrokecolor = span.getAttribute("data-id"); // Update global default
            currentShape.options.stroke = squareStrokecolor; // Update shape option
            currentShape.draw();
            currentShape.updateSidebar(); // Keep sidebar in sync
        } else {
             // If no shape selected, just update the global default for future shapes
             squareStrokecolor = span.getAttribute("data-id");
        }
         SquarecolorOptions.forEach((el) => el.classList.remove("selected"));
         span.classList.add("selected"); // Select the clicked swatch visually
    });
});

backgroundColorOptionsSquare.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            squareBackgroundColor = span.getAttribute("data-id");
            currentShape.options.fill = squareBackgroundColor;
            currentShape.draw();
            currentShape.updateSidebar();
        } else {
            squareBackgroundColor = span.getAttribute("data-id");
        }
        backgroundColorOptionsSquare.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
    });
});

fillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
         if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            squareFillStyleValue = span.getAttribute("data-id");
            currentShape.options.fillStyle = squareFillStyleValue;
            currentShape.draw();
            currentShape.updateSidebar();
        } else {
            squareFillStyleValue = span.getAttribute("data-id");
        }
        fillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
    });
});

squareStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            squareStrokeThicknes = parseInt(span.getAttribute("data-id"));
            currentShape.options.strokeWidth = squareStrokeThicknes;
            currentShape.draw();
            currentShape.updateSidebar();
        } else {
            squareStrokeThicknes = parseInt(span.getAttribute("data-id"));
        }
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
    });
});

squareOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            squareOutlineStyle = span.getAttribute("data-id");
            if (squareOutlineStyle === "dashed") {
                currentShape.options.strokeDasharray = "10,10";
            } else if (squareOutlineStyle === "dotted") {
                currentShape.options.strokeDasharray = "2,8";
            } else {
                currentShape.options.strokeDasharray = "";
            }
            currentShape.draw();
            currentShape.updateSidebar();
        } else {
            squareOutlineStyle = span.getAttribute("data-id");
        }
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
    });
});

// Utility to clone options (simple deep clone)
function cloneOptions(options) {
    // Using JSON parse/stringify is a simple way for plain objects
    return JSON.parse(JSON.stringify(options));
}

// Utility to clone a Rectangle's data (without DOM nodes)
function cloneRectangleData(rect) {
    return {
        x: rect.x, // Include position for relative paste calculation if needed, though currently pasting at mouse
        y: rect.y,
        width: rect.width,
        height: rect.height,
        options: cloneOptions(rect.options),
        rotation: rect.rotation
    };
}

let copiedShapeData = null;

document.addEventListener('keydown', (e) => {
    // Check for Ctrl+C or Cmd+C
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            copiedShapeData = cloneRectangleData(currentShape);
        }
    }
});

document.addEventListener('keydown', (e) => {
    // Check for Ctrl+V or Cmd+V
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedShapeData) {
            e.preventDefault(); // Prevent default paste behavior in input fields etc.

            let pasteX, pasteY;

            // Determine paste location: use last mouse position if available, otherwise center of viewport
            if (lastMousePos && typeof lastMousePos.x === 'number' && typeof lastMousePos.y === 'number') {
                 // lastMousePos is relative to SVG *client* area. Convert to SVG *user* coordinates.
                 const svgPoint = svg.createSVGPoint();
                 svgPoint.x = lastMousePos.x;
                 svgPoint.y = lastMousePos.y;
                 const CTM = svg.getScreenCTM().inverse(); // Get the inverse of the matrix mapping user coords to screen coords
                 const userPoint = svgPoint.matrixTransform(CTM); // Transform the screen point to user coordinates

                 pasteX = userPoint.x;
                 pasteY = userPoint.y;

            } else {
                 // Fallback to center of current SVG viewport (assuming currentViewBox exists and is updated)
                 // Note: Accessing currentViewBox directly might depend on other code not shown.
                 // A safer fallback might be the center of the SVG element's client bounding box.
                 const svgRect = svg.getBoundingClientRect();
                 pasteX = svgRect.width / 2;
                 pasteY = svgRect.height / 2;

                 // If SVG uses viewBox, translate client center to user coordinates
                 const svgPoint = svg.createSVGPoint();
                 svgPoint.x = pasteX;
                 svgPoint.y = pasteY;
                 const CTM = svg.getScreenCTM().inverse();
                 const userPoint = svgPoint.matrixTransform(CTM);

                 pasteX = userPoint.x;
                 pasteY = userPoint.y;
            }

            // Calculate new top-left position so the center of the pasted shape is at pasteX, pasteY
            // Note: This calculates the top-left of the *non-rotated* bounding box.
            const newX = pasteX - copiedShapeData.width / 2;
            const newY = pasteY - copiedShapeData.height / 2;

            // Offset slightly from center if pasting multiple times without moving mouse?
            // Simple offset: paste slightly down and right
             // newX += 10;
             // newY += 10;


            // Deselect all shapes before pasting and selecting the new one
            shapes.forEach(shape => {
                if (shape.isSelected) {
                    shape.removeSelection(); // Use removeSelection to clean up DOM
                }
            });
            currentShape = null; // Ensure currentShape is null before creating new one
            disableAllSideBars(); // Hide sidebar

            // Create new rectangle instance
            const newRect = new Rectangle(
                newX,
                newY,
                copiedShapeData.width,
                copiedShapeData.height,
                cloneOptions(copiedShapeData.options) // Use cloned options
            );
            newRect.rotation = copiedShapeData.rotation; // Copy rotation

            // Add to shapes array
            shapes.push(newRect);

            // Select the newly pasted shape
            newRect.isSelected = true;
            currentShape = newRect;
            newRect.draw(); // Draw with selection handles

            // Push create action for undo/redo
            pushCreateAction(newRect); // Assuming this handles cloning data for undo state
        }
    }
});