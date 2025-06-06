import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';
// Assumed global access: svg, shapes, currentShape, isSquareToolActive, isCircleToolActive, isSelectionToolActive, disableAllSideBars, squareSideBar, circleSideBar, lastMousePos, rough

let circleStartX, circleStartY;
let isDrawingCircle = false;
let isDraggingShapeCircle = false; // Shared state with drawSquare
let isResizingShapeCircle = false; // Shared state with drawSquare
let isRotatingShapeCircle = false; // Shared state with drawSquare
let resizingAnchorIndexCircle = null; // Shared state with drawSquare
let startRotationMouseAngleCircle = 0; // Shared state with drawSquare
let startShapeRotationCircle = 0; // Shared state with drawSquare
let dragOldPosCircle = null; // Shared state with drawSquare


let circleStrokeColor = "#fff"; // Default stroke color
let circleFillColor = "transparent"; // Default fill color
let circleFillStyle = "none"; // Default fill style for sidebar UI mapping
let circleStrokeThickness = 2; // Default stroke thickness
let circleOutlineStyle = "solid"; // Default outline style for sidebar UI mapping

// Assume these exist and are queried from the DOM in a global scope
let circleColorOptions = document.querySelectorAll(".circleStrokeSpan");
let circleFillColorOptions = document.querySelectorAll(".circleBackgroundSpan");
let circleFillStyleOptions = document.querySelectorAll(".circleFillStyleSpan");
let circleStrokeThicknessOptions = document.querySelectorAll(".circleStrokeThickSpan");
let circleOutlineStyleOptions = document.querySelectorAll(".circleOutlineStyle");


const rc = rough.svg(svg);

class Circle {
    constructor(centerX, centerY, radiusX, radiusY, options = {}) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.radiusX = radiusX;
        this.radiusY = radiusY;
        this.options = {
            roughness: 1.5,
            stroke: circleStrokeColor, // Use default
            strokeWidth: circleStrokeThickness, // Use default
            fill: circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor, // Use rgba(0,0,0,0) for roughjs transparent fill
            fillStyle: circleFillStyle === "none" ? 'none' : circleFillStyle, // roughjs uses 'none' fillStyle for no fill pattern/color
            strokeDasharray: circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : ""), // Use default strokeDasharray based on outline style
            ...options // Allow overriding defaults
        };

         // Ensure roughjs fillStyle is 'none' if fill is transparent/none on creation
        if (this.options.fill === "rgba(0,0,0,0)" || this.options.fill === "transparent" || !this.options.fill) {
             this.options.fillStyle = 'none'; // Roughjs specific 'none' fillStyle
        } else if (this.options.fillStyle === "none" && (this.options.fill !== "rgba(0,0,0,0)" && this.options.fill !== "transparent" && this.options.fill)) {
            // If fill is present, but fillStyle was 'none' (e.g., from options override), use hachure
             this.options.fillStyle = 'hachure';
        }


        this.element = null; // The roughjs path element
        this.overlay = null; // Invisible rect for easier selection/drag hit area
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.rotation = 0; // Ellipses can be rotated via group transform
        this.anchors = [];
        this.rotationAnchor = null;
        this.selectionPadding = 8; // Padding around bounding box for anchors/selection outline
        this.selectionOutline = null;
        this.shapeName = 'circle';

        // Add group to SVG on creation
        if (!this.group.parentNode) {
            svg.appendChild(this.group);
        }

         this._lastDrawn = { // Cache for draw optimization (options change check)
            radiusX: null,
            radiusY: null,
            options: null,
            rotation: null
         };

        this.draw(); // Initial draw
    }

    draw() {

        // 1. Remove existing selection elements from the group
         const currentSelectionElements = [
             this.selectionOutline,
             this.rotationAnchor,
             ...this.anchors
         ].filter(el => el !== null && el && el.parentNode === this.group); // Added null/undefined check

         currentSelectionElements.forEach(el => this.group.removeChild(el));
         // Reset the instance properties for selection elements
         this.selectionOutline = null;
         this.rotationAnchor = null;
         this.anchors = [];


        // 2. Determine if the roughjs element needs regeneration (size or options changed)
        const optionsString = JSON.stringify(this.options);
        // Regenerate if element doesn't exist, or if size/options have changed since last draw
        const needsRegen = !this.element || optionsString !== this._lastDrawn.options ||
                           this.radiusX !== this._lastDrawn.radiusX || this.radiusY !== this._lastDrawn.radiusY;

        if (needsRegen) {
            // If regenerating, remove old rough element and overlay from DOM just in case
            if (this.element && this.element.parentNode === this.group) this.group.removeChild(this.element);
            if (this.overlay && this.overlay.parentNode === this.group) this.group.removeChild(this.overlay);

            const drawRadiusX = Math.max(1, this.radiusX); // Ensure minimum size for drawing
            const drawRadiusY = Math.max(1, this.radiusY);

            // Generate new roughjs element
            const roughEllipse = rc.ellipse(
                 this.radiusX, // Center X relative to group's origin
                 this.radiusY, // Center Y relative to group's origin
                 drawRadiusX * 2, // Width
                 drawRadiusY * 2, // Height
                 this.options
            );
            this.element = roughEllipse; // Update instance property

            // Create/update overlay if regenerating main element
             const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
             overlay.setAttribute("fill", "rgba(0,0,0,0)"); // Invisible
             overlay.style.pointerEvents = "all"; // Capture events when needed
             overlay.style.cursor = 'move'; // Default for drag
             this.overlay = overlay; // Update instance property


            // Cache dimensions and options used for the roughjs element
            this._lastDrawn.radiusX = this.radiusX;
            this._lastDrawn.radiusY = this.radiusY;
            this._lastDrawn.options = optionsString;
            // Rotation isn't cached here as it doesn't trigger rc.ellipse
        }

        // 3. Ensure elements are in the DOM in the correct order
        // Append rough element first, then the overlay (overlay needs to be above for pointer events)
        // Check parentNode explicitly to avoid re-appending elements already there
        if (this.element && this.element.parentNode !== this.group) {
            this.group.appendChild(this.element);
        }
        if (this.overlay && this.overlay.parentNode !== this.group) {
            this.group.appendChild(this.overlay);
        }

         // Ensure correct z-order: rough element *below* overlay, both *below* selection elements
         // Check if rough is after overlay, if so, swap them
         if (this.element && this.overlay && this.element.nextSibling === this.overlay) {
             // Order is correct (element -> overlay)
         } else if (this.element && this.overlay && this.overlay.nextSibling === this.element) {
             // Order is incorrect (overlay -> element), swap them
             this.group.insertBefore(this.element, this.overlay);
         }


        // 4. Apply group transform for position and rotation
        // The group's origin (0,0) should be at the top-left of the shape's bounding box (centerX - radiusX, centerY - radiusY).
        // Rotation center should be (radiusX, radiusY) relative to the group's origin, which is the shape's visual center.
        const translateX = this.centerX - this.radiusX;
        const translateY = this.centerY - this.radiusY;
        const rotateCenterX = this.radiusX;
        const rotateCenterY = this.radiusY;
        this.group.setAttribute('transform', `translate(${translateX}, ${translateY}) rotate(${this.rotation}, ${rotateCenterX}, ${rotateCenterY})`);

        // Cache rotation applied to the group transform
         this._lastDrawn.rotation = this.rotation;


        // 5. Add selection elements if selected (these are added *after* main elements)
        if (this.isSelected) {
            this.addAnchors(); // addAnchors appends to group *after* existing children (main elements)
        }

        // Ensure group is in SVG (should be done on creation, but defensive)
        if (!this.group.parentNode) {
            svg.appendChild(this.group);
        }

        // 6. Update overlay pointer events based on selection tool and selection state
        // Pointer events on the overlay should only be 'all' when selection tool is active
        // and the shape is selected, allowing drag interaction on the body.
        // Otherwise, they should be 'none' so mouse events can pass through to other shapes or the SVG background for drawing.
        if (isSelectionToolActive && this.isSelected && this.overlay) {
             this.overlay.style.pointerEvents = "all";
             this.overlay.style.cursor = 'move';
        } else if (this.overlay) { // Turn off pointer events on overlay if not selected or not in selection tool
             this.overlay.style.pointerEvents = "none";
             this.overlay.style.cursor = 'default';
        }

    }

    // Add or replace inside your Circle class:
    contains(x, y) {
        if (!this.group) return false;
        const CTM = this.group.getCTM();
        if (!CTM) return false;
        const inverseCTM = CTM.inverse();

        // Transform the global mouse point to the group's local coordinates
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        const local = svgPoint.matrixTransform(inverseCTM);

        // Ellipse center in local group coordinates is (radiusX, radiusY)
        const dx = local.x - this.radiusX;
        const dy = local.y - this.radiusY;

        // If selected, expand the clickable area to include the selection outline
        if (this.isSelected) {
            const expandedX = -this.selectionPadding;
            const expandedY = -this.selectionPadding;
            const expandedWidth = this.radiusX * 2 + 2 * this.selectionPadding;
            const expandedHeight = this.radiusY * 2 + 2 * this.selectionPadding;
            // Check if local point is within the expanded bounding box rectangle
            return (
                local.x >= expandedX &&
                local.x <= expandedX + expandedWidth &&
                local.y >= expandedY &&
                local.y <= expandedY + expandedHeight
            );
        } else {
             // Standard ellipse hit test with a small tolerance
             const rx = this.radiusX;
             const ry = this.radiusY;
             if (rx < 1 || ry < 1) return false; // Avoid division by zero or tiny shapes
             // Use the ellipse equation: (x-h)^2/rx^2 + (y-k)^2/ry^2 <= 1
             // where (h,k) is the center (radiusX, radiusY) in local space
             const ellipseTest = ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));

             const bboxLeft = 0;
             const bboxTop = 0;
             const bboxRight = this.radiusX * 2;
             const bboxBottom = this.radiusY * 2;

             // Check bounding box first (faster)
             if (local.x < bboxLeft || local.x > bboxRight || local.y < bboxTop || local.y > bboxBottom) {
                  return false; // Outside the main bounding box
             }

             const localCenteredX = local.x - this.radiusX;
             const localCenteredY = local.y - this.radiusY;
             const ellipseValue = (localCenteredX * localCenteredX) / (rx * rx) + (localCenteredY * localCenteredY) / (ry * ry);

             const clickTolerance = 0.1;
             return ellipseValue <= (1 + clickTolerance);
        }
    }

    isNearAnchor(x, y) {
        if (!this.isSelected) return null;

        const buffer = 10;

        const CTM = this.group.getCTM();
        if (!CTM) return null;


        for (let i = 0; i < this.anchors.length; i++) {
            const anchor = this.anchors[i];
            const anchorSize = parseFloat(anchor.getAttribute('width'));
            const anchorLocalCenterX = parseFloat(anchor.getAttribute('x')) + anchorSize / 2;
            const anchorLocalCenterY = parseFloat(anchor.getAttribute('y')) + anchorSize / 2;

             const anchorLocalPoint = svg.createSVGPoint();
             anchorLocalPoint.x = anchorLocalCenterX;
             anchorLocalPoint.y = anchorLocalCenterY;

             const anchorScreenPoint = anchorLocalPoint.matrixTransform(CTM);

             const distSq = (x - anchorScreenPoint.x)**2 + (y - anchorScreenPoint.y)**2;

            if (distSq <= (anchorSize/2 + buffer)**2) {
                 return { type: 'resize', index: i };
            }
        }

        if (this.rotationAnchor) {
            const rotateAnchorLocalX = parseFloat(this.rotationAnchor.getAttribute('cx'));
            const rotateAnchorLocalY = parseFloat(this.rotationAnchor.getAttribute('cy'));
            const rotateAnchorRadius = parseFloat(this.rotationAnchor.getAttribute('r'));

             const rotateAnchorLocalPoint = svg.createSVGPoint();
             rotateAnchorLocalPoint.x = rotateAnchorLocalX;
             rotateAnchorLocalPoint.y = rotateAnchorLocalY;

             const rotateAnchorScreenPoint = rotateAnchorLocalPoint.matrixTransform(CTM);

             const distSq = (x - rotateAnchorScreenPoint.x)**2 + (y - rotateAnchorScreenPoint.y)**2;

            if (distSq <= (rotateAnchorRadius + buffer)**2) {
                 return { type: 'rotate' };
            }
        }

        return null;
    }


    getRotatedCursor(directionIndex, angle) {
        const baseDirections = [
            'nwse', 'nesw', 'nesw', 'nwse',
            'ns', 'ns',
            'ew', 'ew'
        ];

        const baseDirection = baseDirections[directionIndex];
        if (!baseDirection) return 'default';

        let angleOffset = 0;
        if (directionIndex <= 3) {
             angleOffset = 45 + 90 * directionIndex;
        } else if (directionIndex === 4) {
            angleOffset = 0;
        } else if (directionIndex === 5) {
            angleOffset = 180;
        } else if (directionIndex === 6) {
            angleOffset = 270;
        } else if (directionIndex === 7) {
            angleOffset = 90;
        }


        let effectiveAngle = angle + angleOffset;

        effectiveAngle = ((effectiveAngle % 360) + 360) % 360;


        if ((effectiveAngle >= 337.5 || effectiveAngle < 22.5)) return 'ns';
        if (effectiveAngle >= 22.5 && effectiveAngle < 67.5) return 'nesw';
        if (effectiveAngle >= 67.5 && effectiveAngle < 112.5) return 'ew';
        if (effectiveAngle >= 112.5 && effectiveAngle < 157.5) return 'nwse';
        if (effectiveAngle >= 157.5 && effectiveAngle < 202.5) return 'ns';
        if (effectiveAngle >= 202.5 && effectiveAngle < 247.5) return 'nesw';
        if (effectiveAngle >= 247.5 && effectiveAngle < 292.5) return 'ew';
        if (effectiveAngle >= 292.5 && effectiveAngle < 337.5) return 'nwse';


        return 'default';
    }

    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this;

        this.anchors.forEach(anchor => {
             if (anchor && anchor.parentNode === this.group) {
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

        const expandedX = -this.selectionPadding;
        const expandedY = -this.selectionPadding;
        const expandedWidth = this.radiusX * 2 + 2 * this.selectionPadding;
        const expandedHeight = this.radiusY * 2 + 2 * this.selectionPadding;

        const positions = [
            { x: expandedX, y: expandedY }, // NW (0)
            { x: expandedX + expandedWidth, y: expandedY }, // NE (1)
            { x: expandedX, y: expandedY + expandedHeight }, // SW (2)
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight }, // SE (3)
            { x: expandedX + expandedWidth / 2, y: expandedY }, // N-Mid (4)
            { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight }, // S-Mid (5)
            { x: expandedX, y: expandedY + expandedHeight / 2 }, // W-Mid (6)
            { x: expandedX + expandedWidth, y: expandedHeight / 2 + expandedY } // E-Mid (7)
        ];


        positions.forEach((pos, i) => {
            const anchor = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            anchor.setAttribute('x', pos.x - anchorSize / 2);
            anchor.setAttribute('y', pos.y - anchorSize / 2);
            anchor.setAttribute('width', anchorSize);
            anchor.setAttribute('height', anchorSize);
            anchor.setAttribute('class', 'anchor');
            anchor.setAttribute('data-index', i);
            anchor.setAttribute('fill', '#121212');
            anchor.setAttribute('stroke', '#5B57D1');
            anchor.setAttribute('stroke-width', anchorStrokeWidth);
            anchor.style.pointerEvents = "all";
            anchor.style.zIndex = "1000";


            anchor.addEventListener('mouseover', function (event) {
                 if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
                    const index = parseInt(this.getAttribute('data-index'));
                    const rotatedCursor = self.getRotatedCursor(index, self.rotation);
                    svg.style.cursor = rotatedCursor + '-resize';
                 }
            });

            anchor.addEventListener('mouseout', function (event) {
                 if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
                     const mouseX = event.offsetX;
                     const mouseY = event.offsetY;
                      if (isSelectionToolActive && currentShape === self && self.isSelected && self.contains(mouseX, mouseY)) {
                           svg.style.cursor = 'move';
                      } else if (isSelectionToolActive) {
                           let hoveredShape = null;
                            for (let i = shapes.length - 1; i >= 0; i--) {
                                const shape = shapes[i];
                                 if (shape.shapeName === 'circle' && shape.contains(mouseX, mouseY)) {
                                     hoveredShape = shape;
                                     break;
                                 }
                            }
                           svg.style.cursor = hoveredShape ? 'pointer' : 'default';
                      } else {
                           svg.style.cursor = 'default';
                      }
                 }
            });

            this.group.appendChild(anchor);
            this.anchors[i] = anchor;
        });

        const rotationAnchorPos = { x: expandedX + expandedWidth / 2, y: expandedY - 30 };
        this.rotationAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        this.rotationAnchor.setAttribute('cx', rotationAnchorPos.x);
        this.rotationAnchor.setAttribute('cy', rotationAnchorPos.y);
        this.rotationAnchor.setAttribute('r', 8);
        this.rotationAnchor.setAttribute('class', 'rotate-anchor');
        this.rotationAnchor.setAttribute('fill', '#121212');
        this.rotationAnchor.setAttribute('stroke', '#5B57D1');
        this.rotationAnchor.setAttribute('stroke-width', anchorStrokeWidth);
        this.rotationAnchor.style.pointerEvents = "all";
        this.group.appendChild(this.rotationAnchor);

        this.rotationAnchor.addEventListener('mouseover', function (event) {
             if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
                 svg.style.cursor = 'grab';
             }
        });
        this.rotationAnchor.addEventListener('mouseout', function (event) {
            if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
                const mouseX = event.offsetX;
                const mouseY = event.offsetY;
                 if (isSelectionToolActive && currentShape === self && self.isSelected && self.contains(mouseX, mouseY)) {
                      svg.style.cursor = 'move';
                 } else if (isSelectionToolActive) {
                      let hoveredShape = null;
                       for (let i = shapes.length - 1; i >= 0; i--) {
                           const shape = shapes[i];
                            if (shape.shapeName === 'circle' && shape.contains(mouseX, mouseY)) {
                                hoveredShape = shape;
                                break;
                            }
                       }
                      svg.style.cursor = hoveredShape ? 'pointer' : 'default';
                 } else {
                      svg.style.cursor = 'default';
                 }
            }
        });

        const outlinePoints = [
            [positions[0].x, positions[0].y],
            [positions[1].x, positions[1].y],
            [positions[3].x, positions[3].y],
            [positions[2].x, positions[2].y],
            [positions[0].x, positions[0].y]
        ];
        const pointsAttr = outlinePoints.map(p => p.join(',')).join(' ');
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        outline.setAttribute('points', pointsAttr);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#5B57D1');
        outline.setAttribute('stroke-width', 1.5);
        outline.setAttribute('stroke-dasharray', '4 2');
        outline.style.pointerEvents = "none";
        this.group.appendChild(outline);
        this.selectionOutline = outline;

        disableAllSideBars();
        circleSideBar.classList.remove("hidden");
        this.updateSidebar();
    }

    removeSelection() {
        this.anchors.forEach(anchor => {
             if (anchor && anchor.parentNode === this.group) {
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
    }

    select() {
        shapes.forEach(shape => {
             if (shape !== this && shape.isSelected && typeof shape.deselect === 'function') {
                 shape.deselect();
             }
        });

        if (!this.isSelected) {
            this.isSelected = true;
            currentShape = this;
            this.draw();
        } else {
             currentShape = this;
             this.addAnchors();
             disableAllSideBars();
             circleSideBar.classList.remove("hidden");
             this.updateSidebar();
        }
    }

    deselect() {
        if (this.isSelected) {
            this.isSelected = false;
            this.removeSelection();
            if (currentShape === this) {
                 currentShape = null;
            }
            disableAllSideBars();
             this.draw();
        }
    }

    move(dx, dy) {
        this.centerX += dx;
        this.centerY += dy;
    }

    updatePosition(anchorIndex, newMouseX, newMouseY, shiftKey = false) {
        const CTM = this.group.getCTM();
        if (!CTM) return;
    
        const inverseCTM = CTM.inverse();
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = newMouseX;
        svgPoint.y = newMouseY;
        const localMouse = svgPoint.matrixTransform(inverseCTM);
    
        const oldX = 0;
        const oldY = 0;
        const oldWidth = this.radiusX * 2;
        const oldHeight = this.radiusY * 2;
    
        let newLocalX = 0;
        let newLocalY = 0;
        let newWidth = oldWidth;
        let newHeight = oldHeight;
    
        switch (anchorIndex) {
            case 0: // NW
                newLocalX = localMouse.x;
                newLocalY = localMouse.y;
                newWidth = oldWidth - newLocalX;
                newHeight = oldHeight - newLocalY;
                break;
            case 1: // NE
                newLocalY = localMouse.y;
                newWidth = localMouse.x - oldX;
                newHeight = oldHeight - newLocalY;
                break;
            case 2: // SW
                newLocalX = localMouse.x;
                newWidth = oldWidth - newLocalX;
                newHeight = localMouse.y - oldY;
                break;
            case 3: // SE
                newWidth = localMouse.x - oldX;
                newHeight = localMouse.y - oldY;
                break;
            case 4: // N-mid
                newLocalY = localMouse.y;
                newHeight = oldHeight - newLocalY;
                break;
            case 5: // S-mid
                newHeight = localMouse.y - oldY;
                break;
            case 6: // W-mid
                newLocalX = localMouse.x;
                newWidth = oldWidth - newLocalX;
                break;
            case 7: // E-mid
                newWidth = localMouse.x - oldX;
                break;
        }
    
        const minSize = 2;
        newWidth = Math.max(newWidth, minSize);
        newHeight = Math.max(newHeight, minSize);
    
        if (shiftKey) {
            const aspect = this.radiusX / this.radiusY;
            if (newWidth / newHeight > aspect) {
                newWidth = newHeight * aspect;
            } else {
                newHeight = newWidth / aspect;
            }
    
            // Recompute anchor-relative mouse X/Y based on aspect-adjusted width/height
            switch (anchorIndex) {
                case 0:
                    newLocalX = oldWidth - newWidth;
                    newLocalY = oldHeight - newHeight;
                    break;
                case 1:
                    newLocalY = oldHeight - newHeight;
                    break;
                case 2:
                    newLocalX = oldWidth - newWidth;
                    break;
                // anchors 3, 4, 5, 6, 7 do not need to be re-adjusted
            }
        }
    
        // Apply center shift and radii update
        this.centerX += newLocalX + (newWidth - oldWidth) / 2;
        this.centerY += newLocalY + (newHeight - oldHeight) / 2;
        this.radiusX = newWidth / 2;
        this.radiusY = newHeight / 2;
    }

    

    getGlobalAnchorPositions(CTM) {
        const expandedX = -this.selectionPadding;
        const expandedY = -this.selectionPadding;
        const expandedWidth = this.radiusX * 2 + 2 * this.selectionPadding;
        const expandedHeight = this.radiusY * 2 + 2 * this.selectionPadding;

        const positions = [
            { x: expandedX, y: expandedY },
            { x: expandedX + expandedWidth, y: expandedY },
            { x: expandedX, y: expandedY + expandedHeight },
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight },
            { x: expandedX + expandedWidth / 2, y: expandedY },
            { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight },
            { x: expandedX, y: expandedHeight / 2 + expandedY },
            { x: expandedX + expandedWidth, y: expandedHeight / 2 + expandedY }
        ];

        return positions.map(pos => {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = pos.x;
            svgPoint.y = pos.y;
            return svgPoint.matrixTransform(CTM);
        });
    }

    rotate(angle) {
        angle = ((angle % 360) + 360) % 360;
        this.rotation = angle;
    }

    updateSidebar() {
        if (!circleColorOptions || !circleFillColorOptions || !circleFillStyleOptions || !circleStrokeThicknessOptions || !circleOutlineStyleOptions) {
             console.warn("Circle sidebar elements not found. Cannot update sidebar.");
             return;
        }

        circleColorOptions.forEach(span => {
            const color = span.getAttribute("data-id");
            if (color === this.options.stroke) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });

        circleFillColorOptions.forEach(span => {
             const color = span.getAttribute("data-id");
             const shapeFill = (this.options.fill === "rgba(0,0,0,0)" || this.options.fill === "none" || !this.options.fill) ? "transparent" : this.options.fill;
            if (color === shapeFill) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });

        circleFillStyleOptions.forEach(span => {
            const style = span.getAttribute("data-id");
             let currentStyle = this.options.fillStyle;
             if (style === currentStyle) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
             }
        });

        circleStrokeThicknessOptions.forEach(span => {
             const thickness = parseInt(span.getAttribute("data-id"));
            if (thickness === this.options.strokeWidth) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
            }
        });

        circleOutlineStyleOptions.forEach(span => {
            const style = span.getAttribute("data-id");
            let currentStyle = "solid";
            if (this.options.strokeDasharray === "10,10") currentStyle = "dashed";
            else if (this.options.strokeDasharray === "2,8") currentStyle = "dotted";
            else currentStyle = "solid";

            if (style === currentStyle) {
                span.classList.add("selected");
            } else {
                span.classList.remove("selected");
            }
        });
    }
}


function getSVGCoordsFromMouse(e) {
    const svgRect = svg.getBoundingClientRect();
    // Get current viewBox
    const viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    const [vx, vy, vw, vh] = viewBox;
    const px = (e.clientX - svgRect.left) / svgRect.width;
    const py = (e.clientY - svgRect.top) / svgRect.height;
    return {
        x: vx + px * vw,
        y: vy + py * vh
    };
}



function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
        const idx = shapes.indexOf(currentShape);
        if (idx !== -1) {
            shapes.splice(idx, 1);
        }
        if (currentShape.group.parentNode) {
            currentShape.group.parentNode.removeChild(currentShape.group);
        }
        pushDeleteAction(currentShape);
        currentShape = null;
        disableAllSideBars();
        svg.style.cursor = 'default';
    }
}

document.addEventListener('keydown', (e) => {
     if (e.target.closest('input, textarea, select, button, [contenteditable="true"]')) {
         return;
     }
    if (e.key === 'Delete' || e.key === 'Backspace') {
         if (currentShape && currentShape.isSelected) {
              deleteCurrentShape();
              e.preventDefault();
         }
    }
});


const handleMouseDown = (e) => {
    if (!isCircleToolActive && !isSelectionToolActive) {
        return;
    }
    if (e.button !== 0) {
        return;
    }

    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);

    if (isCircleToolActive) {
        circleStartX = mouseX;
        circleStartY = mouseY;
        isDrawingCircle = true;

        if (currentShape) {
            currentShape.deselect();
        }

        let initialOptions = {
            stroke: circleStrokeColor,
            strokeWidth: circleStrokeThickness,
            fill: circleFillColor,
            fillStyle: circleFillStyle,
        };
        if (circleOutlineStyle === "dashed") {
            initialOptions.strokeDasharray = "10,10";
        } else if (circleOutlineStyle === "dotted") {
            initialOptions.strokeDasharray = "2,8";
        } else {
            initialOptions.strokeDasharray = "";
        }

        if (initialOptions.fill === "rgba(0,0,0,0)" || initialOptions.fill === "transparent" || !initialOptions.fill) {
             initialOptions.fillStyle = 'none';
        } else if (initialOptions.fillStyle === "none") {
             initialOptions.fillStyle = 'hachure';
        }

         currentShape = new Circle(circleStartX, circleStartY, 0, 0, initialOptions);
         shapes.push(currentShape);


    } else if (isSelectionToolActive) {

        let interactionStarted = false;

        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
             const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
             if (anchorInfo) {
                 e.stopPropagation();
                 dragOldPosCircle = {
                     centerX: currentShape.centerX,
                     centerY: currentShape.centerY,
                     radiusX: currentShape.radiusX,
                     radiusY: currentShape.radiusY,
                     rotation: currentShape.rotation
                 };

                 if (anchorInfo.type === 'resize') {
                     isResizingShapeCircle = true;
                     resizingAnchorIndexCircle = anchorInfo.index;
                 } else if (anchorInfo.type === 'rotate') {
                     isRotatingShapeCircle = true;

                     const CTM = currentShape.group.getCTM();
                     if (CTM) {
                         const svgPoint = svg.createSVGPoint();
                         svgPoint.x = currentShape.radiusX;
                         svgPoint.y = currentShape.radiusY;
                         const centerSVG = svgPoint.matrixTransform(CTM);

                         startRotationMouseAngleCircle = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;
                         startShapeRotationCircle = currentShape.rotation;
                     } else {
                          isRotatingShapeCircle = false;
                          console.warn("Could not get CTM for rotation.");
                     }
                 }
                 interactionStarted = true;
             }
        }

        if (!interactionStarted && currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            if (currentShape.contains(mouseX, mouseY)) {
                 e.stopPropagation();
                 isDraggingShapeCircle = true;
                 dragOldPosCircle = {
                     centerX: currentShape.centerX,
                     centerY: currentShape.centerY,
                     radiusX: currentShape.radiusX,
                     radiusY: currentShape.radiusY,
                     rotation: currentShape.rotation
                 };
                 circleStartX = mouseX;
                 circleStartY = mouseY;
                 interactionStarted = true;
             }
        }

        if (!interactionStarted) {
            let shapeToSelect = null;
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                 if (shape.shapeName === 'circle' && shape.contains(mouseX, mouseY)) {
                     shapeToSelect = shape;
                     break;
                }
            }

            if (shapeToSelect) {
                 e.stopPropagation();
                shapeToSelect.select();

                 isDraggingShapeCircle = true;
                 dragOldPosCircle = {
                     centerX: shapeToSelect.centerX,
                     centerY: shapeToSelect.centerY,
                     radiusX: shapeToSelect.radiusX,
                     radiusY: shapeToSelect.radiusY,
                     rotation: shapeToSelect.rotation
                 };
                 circleStartX = mouseX;
                 circleStartY = mouseY;
            } else {
                if (currentShape) {
                    currentShape.deselect();
                }
            }
        }
    }
};

const handleMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getSVGCoordsFromMouse(e);
    const svgRect = svg.getBoundingClientRect();

    if (typeof lastMousePos !== 'undefined') {
        lastMousePos = {
            x: e.clientX - svgRect.left,
            y: e.clientY - svgRect.top
        };
    }


    if (isDrawingCircle && currentShape && currentShape.shapeName === 'circle') {
        const endX = mouseX;
        const endY = mouseY;

        const newCenterX = (circleStartX + endX) / 2;
        const newCenterY = (circleStartY + endY) / 2;
        const newRadiusX = Math.abs(endX - circleStartX) / 2;
        const newRadiusY = Math.abs(endY - circleStartY) / 2;

        currentShape.centerX = newCenterX;
        currentShape.centerY = newCenterY;
        currentShape.radiusX = newRadiusX;
        currentShape.radiusY = newRadiusY;

        currentShape.draw();

    } else if (isDraggingShapeCircle && currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
        const dx = mouseX - circleStartX;
        const dy = mouseY - circleStartY;

        currentShape.move(dx, dy);
        circleStartX = mouseX;
        circleStartY = mouseY;
        currentShape.draw();
        svg.style.cursor = 'move';

    } else if (isResizingShapeCircle && currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected && resizingAnchorIndexCircle !== null) {
        currentShape.updatePosition(resizingAnchorIndexCircle, mouseX, mouseY, e.shiftKey);
        currentShape.draw();
    }
    else if (isRotatingShapeCircle && currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
        const CTM = currentShape.group.getCTM();
        if (CTM) {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = currentShape.radiusX;
            svgPoint.y = currentShape.radiusY;
            const centerSVG = svgPoint.matrixTransform(CTM);

            const currentRotationMouseAngle = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;

            let angleDiff = currentRotationMouseAngle - startRotationMouseAngleCircle;

            if (angleDiff > 180) angleDiff -= 360;
            if (angleDiff < -180) angleDiff += 360;

            let newRotation = startShapeRotationCircle + angleDiff;

            const snapAngle = 15;
            if (e.shiftKey) {
                newRotation = Math.round(newRotation / snapAngle) * snapAngle;
            }

            currentShape.rotate(newRotation);
            currentShape.draw();
            svg.style.cursor = 'grabbing';
        } else {
            isRotatingShapeCircle = false;
            svg.style.cursor = 'default';
        }
    }
    else if (isSelectionToolActive && !isDrawingCircle && !isDraggingShapeCircle && !isResizingShapeCircle && !isRotatingShapeCircle) {

         if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
             // Make sure isNearAnchor is defined in the Circle class
             if (typeof currentShape.isNearAnchor === 'function') {
                 const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
                  if (anchorInfo) {
                      if (anchorInfo.type === 'resize') {
                          const rotatedCursor = currentShape.getRotatedCursor(anchorInfo.index, currentShape.rotation);
                          svg.style.cursor = rotatedCursor + '-resize';
                      } else if (anchorInfo.type === 'rotate') {
                           svg.style.cursor = 'grab';
                      }
                       return;
                  }
             }


              if (currentShape.contains(mouseX, mouseY)) {
                   svg.style.cursor = 'move';
                   return;
              }
         }

         let hoveredShape = null;
         for (let i = shapes.length - 1; i >= 0; i--) {
             const shape = shapes[i];
              if (shape.shapeName === 'circle' && shape.contains(mouseX, mouseY)) {
                 hoveredShape = shape;
                 break;
             }
         }

         if (hoveredShape) {
             svg.style.cursor = 'pointer';
         } else {
             svg.style.cursor = 'default';
         }
    } else {
        if (!isDrawingCircle && !isDraggingShapeCircle && !isResizingShapeCircle && !isRotatingShapeCircle) {
            svg.style.cursor = 'default';
        }
    }
};

const handleMouseUp = (e) => {
    if (!isDrawingCircle && !isDraggingShapeCircle && !isResizingShapeCircle && !isRotatingShapeCircle) {
        return;
    }

    if (isDrawingCircle && currentShape && currentShape.shapeName === 'circle') {
        const MIN_SIZE = 2;
        const currentVisualWidth = currentShape.radiusX * 2;
        const currentVisualHeight = currentShape.radiusY * 2;

        if (currentVisualWidth < MIN_SIZE || currentVisualHeight < MIN_SIZE) {
             const idx = shapes.indexOf(currentShape);
             if (idx !== -1) shapes.splice(idx, 1);
             if (currentShape.group.parentNode) {
                 currentShape.group.parentNode.removeChild(currentShape.group);
             }
            currentShape = null;
        } else {
             pushCreateAction(currentShape);
             currentShape = null;
        }
        if (!currentShape) {
           disableAllSideBars();
        }
    }

    if ((isDraggingShapeCircle || isResizingShapeCircle || isRotatingShapeCircle) && dragOldPosCircle && currentShape && currentShape.shapeName === 'circle') {
        const newPos = {
            centerX: currentShape.centerX,
            centerY: currentShape.centerY,
            radiusX: currentShape.radiusX,
            radiusY: currentShape.radiusY,
            rotation: currentShape.rotation
        };

        const stateChanged = Math.abs(dragOldPosCircle.centerX - newPos.centerX) > Number.EPSILON ||
                             Math.abs(dragOldPosCircle.centerY - newPos.centerY) > Number.EPSILON ||
                             Math.abs(dragOldPosCircle.radiusX - newPos.radiusX) > Number.EPSILON ||
                             Math.abs(dragOldPosCircle.radiusY - newPos.radiusY) > Number.EPSILON ||
                             Math.abs(dragOldPosCircle.rotation - newPos.rotation) > Number.EPSILON;


        if (stateChanged) {
             pushTransformAction(currentShape, dragOldPosCircle, newPos);
        }

        dragOldPosCircle = null;
    }


    isDrawingCircle = false;
    isDraggingShapeCircle = false;
    isResizingShapeCircle = false;
    isRotatingShapeCircle = false;
    resizingAnchorIndexCircle = null;
    startRotationMouseAngleCircle = 0;
    startShapeRotationCircle = 0;

    if (!isSelectionToolActive) {
         svg.style.cursor = 'default';
    } else {
         const mouseX = e.offsetX;
         const mouseY = e.offsetY;
         const dummyEvent = {
             offsetX: mouseX,
             offsetY: mouseY,
             clientX: e.clientX,
             clientY: e.clientY,
             shiftKey: e.shiftKey,
             target: e.target
         };
         handleMouseMove(dummyEvent);
    }

};


svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);


// --- Sidebar Option Event Listeners ---

circleColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const color = span.getAttribute("data-id");

        circleStrokeColor = color;
         circleColorOptions.forEach((el) => el.classList.remove("selected"));
         span.classList.add("selected");

        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            currentShape.options.stroke = color;
            currentShape.draw();
        }
    });
});

circleFillColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const color = span.getAttribute("data-id");

        circleFillColor = color;
        circleFillColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");

        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
             pushOptionsChangeAction(currentShape, { ...currentShape.options });
             currentShape.options.fill = color === "transparent" ? "rgba(0,0,0,0)" : color;

             if (currentShape.options.fill === "rgba(0,0,0,0)" || currentShape.options.fill === "transparent" || !currentShape.options.fill) {
                  currentShape.options.fillStyle = 'none';
             } else if (circleFillStyle !== 'none') {
                  currentShape.options.fillStyle = circleFillStyle;
             } else {
                 currentShape.options.fillStyle = 'hachure';
             }

            currentShape.draw();
            currentShape.updateSidebar();
        }
    });
});

circleFillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        const style = span.getAttribute("data-id");

        circleFillStyle = style;
        circleFillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");


         if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
             currentShape.options.fillStyle = style;

             if (style !== 'none' && (currentShape.options.fill === "rgba(0,0,0,0)" || currentShape.options.fill === "transparent" || !currentShape.options.fill)) {
                 currentShape.options.fill = circleFillColor === "transparent" ? "#000" : circleFillColor;
             } else if (style === 'none') {
                  currentShape.options.fill = "rgba(0,0,0,0)";
             }


            currentShape.draw();
            currentShape.updateSidebar();
        }
    });
});

circleStrokeThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        const thickness = parseInt(span.getAttribute("data-id"));

        circleStrokeThickness = thickness;
        circleStrokeThicknessOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");


        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options });
            currentShape.options.strokeWidth = thickness;
            currentShape.draw();
        }
    });
});

circleOutlineStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const style = span.getAttribute("data-id");

        circleOutlineStyle = style;
        circleOutlineStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");


        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
             pushOptionsChangeAction(currentShape, { ...currentShape.options });
            if (style === "dashed") {
                currentShape.options.strokeDasharray = "10,10";
            } else if (style === "dotted") {
                currentShape.options.strokeDasharray = "2,8";
            } else {
                currentShape.options.strokeDasharray = "";
            }
            currentShape.draw();
        }
    });
});


// --- Copy/Paste Functionality ---

function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneCircleData(circle) {
    return {
        centerX: circle.centerX,
        centerY: circle.centerY,
        radiusX: circle.radiusX,
        radiusY: circle.radiusY,
        options: cloneOptions(circle.options),
        rotation: circle.rotation,
        shapeName: 'circle'
    };
}

let copiedShapeData = null; // Shared state with drawSquare/other shape files

document.addEventListener('keydown', (e) => {
     if (e.target.closest('input, textarea, select, button, [contenteditable="true"]')) {
         return;
     }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            copiedShapeData = cloneCircleData(currentShape);
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, button, [contenteditable="true"]')) {
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && copiedShapeData && copiedShapeData.shapeName === 'circle') {
        e.preventDefault();

        let pasteX, pasteY;
        if (typeof lastMousePos !== 'undefined' && lastMousePos && typeof lastMousePos.x === 'number' && typeof lastMousePos.y === 'number') {
            pasteX = lastMousePos.x;
            pasteY = lastMousePos.y;
        } else {
            const svgWidth = parseFloat(svg.getAttribute('width')) || 800;
            const svgHeight = parseFloat(svg.getAttribute('height')) || 600;
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
                const parts = viewBox.split(' ');
                if (parts.length === 4) {
                    const vx = parseFloat(parts[0]);
                    const vy = parseFloat(parts[1]);
                    const vw = parseFloat(parts[2]);
                    const vh = parseFloat(parts[3]);
                    pasteX = vx + vw / 2;
                    pasteY = vy + vh / 2;
                } else {
                    pasteX = svgWidth / 2;
                    pasteY = svgHeight / 2;
                }
            } else {
                pasteX = svgWidth / 2;
                pasteY = svgHeight / 2;
            }
        }

        let newCenterX = pasteX + 10;
        let newCenterY = pasteY + 10;

        shapes.forEach(shape => {
             if (shape.isSelected && typeof shape.deselect === 'function') {
                 shape.deselect();
             }
        });
        currentShape = null;
        disableAllSideBars();

        const newCircle = new Circle(
            newCenterX,
            newCenterY,
            copiedShapeData.radiusX,
            copiedShapeData.radiusY,
            cloneOptions(copiedShapeData.options)
        );
        newCircle.rotation = copiedShapeData.rotation;
        shapes.push(newCircle);
        newCircle.draw();
        pushCreateAction(newCircle);
    }
});