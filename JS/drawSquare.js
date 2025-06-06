import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';
let isDrawingSquare = false;
let isDraggingShapeSquare = false;
let isResizingShapeSquare = false;
let isRotatingShapeSquare = false;
let resizingAnchorIndexSquare = null;
let startRotationMouseAngleSquare = 0;
let startShapeRotationSquare = 0;
const rc = rough.svg(svg); 
let startX, startY;
let squareStrokecolor = "#fff";
let squareBackgroundColor = "transparent";
let squareFillStyleValue = "none";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";
let dragOldPosSquare = null;
let oldOptions = null;
let SquarecolorOptions = document.querySelectorAll(".squareStrokeSpan");
let backgroundColorOptionsSquare = document.querySelectorAll(".squareBackgroundSpan");
let fillStyleOptions = document.querySelectorAll(".squareFillStyleSpan");
let squareStrokeThicknessValue = document.querySelectorAll(".squareStrokeThickSpan");
let squareOutlineStyleValue = document.querySelectorAll(".squareOutlineStyle");



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
         // Add group to SVG on creation
         if (!this.group.parentNode) {
             svg.appendChild(this.group);
         }
         this._lastDrawn = {
            width: null,
            height: null,
            options: null
        };
        this.draw(); // Initial draw
    }
    draw() {
        const childrenToRemove = [];
        for (let i = 0; i < this.group.children.length; i++) {
            const child = this.group.children[i];
            if (child !== this.element) { 
                 childrenToRemove.push(child);
            }
        }
         childrenToRemove.forEach(child => this.group.removeChild(child));
        if (this.element && this.element.parentNode === this.group) {
             this.group.removeChild(this.element);
             this.element = null;
        }
        const optionsString = JSON.stringify(this.options);
        const isInitialDraw = this.element === null;
        const optionsChanged = optionsString !== this._lastDrawn.options;
        const sizeChanged = this.width !== this._lastDrawn.width || this.height !== this._lastDrawn.height;
        
        if (isInitialDraw || optionsChanged) {
            if (this.element && this.element.parentNode === this.group) {
                this.group.removeChild(this.element);
            }
            const roughRect = rc.rectangle(0, 0, this.width, this.height, this.options);
            this.element = roughRect;
            this.group.appendChild(roughRect);
        
            // Cache only options
            this._lastDrawn.width = this.width;
            this._lastDrawn.height = this.height;
            this._lastDrawn.options = optionsString;
        }
        

        const rotateCenterX = this.width / 2;
        const rotateCenterY = this.height / 2;
        this.group.setAttribute('transform', `translate(${this.x}, ${this.y}) rotate(${this.rotation}, ${rotateCenterX}, ${rotateCenterY})`);
        if (this.isSelected) {
            this.addAnchors();
        }
        if (!this.group.parentNode) {
            svg.appendChild(this.group);
        }
    }
    getRotatedCursor(direction, angle) {
        const directions = ['ns', 'nesw', 'ew', 'nwse'];
        angle = angle % 360;
        if (angle < 0) angle += 360;

        const baseDirectionMap = {
            '0': 'nwse', '1': 'nesw', 
            '2': 'nesw', '3': 'nwse', 
            '4': 'ns',   '5': 'ns',     
            '6': 'ew',   '7': 'ew'      
        };
        const baseDirection = baseDirectionMap[direction];
        let effectiveAngle = angle; 
        if (baseDirection === 'nesw') {
            effectiveAngle += 45;
        } else if (baseDirection === 'ew') {
            effectiveAngle += 90;
        } else if (baseDirection === 'nwse') {
            effectiveAngle += 135;
        }
        effectiveAngle = effectiveAngle % 360;
        if (effectiveAngle < 0) effectiveAngle += 360;
        const index = Math.round(effectiveAngle / 45) % 4; 
         let finalIndex;
         if (effectiveAngle >= 337.5 || effectiveAngle < 22.5) finalIndex = 0; 
         else if (effectiveAngle >= 22.5 && effectiveAngle < 67.5) finalIndex = 1; 
         else if (effectiveAngle >= 67.5 && effectiveAngle < 112.5) finalIndex = 2; 
         else if (effectiveAngle >= 112.5 && effectiveAngle < 157.5) finalIndex = 3;
         else if (effectiveAngle >= 157.5 && effectiveAngle < 202.5) finalIndex = 0; 
         else if (effectiveAngle >= 202.5 && effectiveAngle < 247.5) finalIndex = 1; 
         else if (effectiveAngle >= 247.5 && effectiveAngle < 292.5) finalIndex = 2; 
         else if (effectiveAngle >= 292.5 && effectiveAngle < 337.5) finalIndex = 3; 
         else finalIndex = 0; 
        return directions[finalIndex];
    }
    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this;
        const expandedX = -this.selectionPadding; 
        const expandedY = -this.selectionPadding; 
        const expandedWidth = this.width + 2 * this.selectionPadding;
        const expandedHeight = this.height + 2 * this.selectionPadding;

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

        const outlinePoints = [
            [positions[0].x, positions[0].y],
            [positions[1].x, positions[1].y],
            [positions[3].x, positions[3].y],
            [positions[2].x, positions[2].y],
            [positions[0].x, positions[0].y]
        ];

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
            0: 'nwse', 
            1: 'nesw', 
            2: 'nesw', 
            3: 'nwse', 
            4: 'ns',   
            5: 'ns',   
            6: 'ew',   
            7: 'ew'    
        };

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
            anchor.setAttribute('style', 'pointer-events: all;'); 

            anchor.addEventListener('mouseover', function () {
                const index = this.getAttribute('data-index');
                const baseDirection = anchorDirections[index];
                const rotatedCursor = self.getRotatedCursor(index, self.rotation); 
                svg.style.cursor = rotatedCursor + '-resize';
            });

            anchor.addEventListener('mouseout', function () {
                 if (!isResizingShapeSquare && !isDraggingShapeSquare && !isRotatingShapeSquare) {
                     svg.style.cursor = 'default';
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
        this.rotationAnchor.setAttribute('style', 'pointer-events: all;');
        this.group.appendChild(this.rotationAnchor);

        this.rotationAnchor.addEventListener('mouseover', function () {
             if (!isResizingShapeSquare && !isDraggingShapeSquare && !isRotatingShapeSquare) {
                 svg.style.cursor = 'grab';
             }
        });
        this.rotationAnchor.addEventListener('mouseout', function () {
            if (!isResizingShapeSquare && !isDraggingShapeSquare && !isRotatingShapeSquare) {
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
        outline.setAttribute('style', 'pointer-events: none;'); 
        this.group.appendChild(outline);
        this.selectionOutline = outline;

        // Show relevant sidebar
        disableAllSideBars();
        squareSideBar.classList.remove("hidden");
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
         if (!this.element) return false; 
        const CTM = this.group.getCTM();
        if (!CTM) return false; 
        const inverseCTM = CTM.inverse();

        const svgPoint = svg.createSVGPoint();
        svgPoint.x = x;
        svgPoint.y = y;
        const transformedPoint = svgPoint.matrixTransform(inverseCTM);
        const tolerance = 5;
        return transformedPoint.x >= -tolerance && transformedPoint.x <= this.width + tolerance &&
               transformedPoint.y >= -tolerance && transformedPoint.y <= this.height + tolerance;
    }

     // Helper to check if a point is near an anchor
     isNearAnchor(x, y) {
         if (!this.isSelected) return null;
         const buffer = 10; 
         const anchorSize = 10; 

         // Iterate through anchors
         for (let i = 0; i < this.anchors.length; i++) {
             const anchor = this.anchors[i];
             const anchorLocalX = parseFloat(anchor.getAttribute('x')) + anchorSize / 2;
             const anchorLocalY = parseFloat(anchor.getAttribute('y')) + anchorSize / 2;
             const svgPoint = svg.createSVGPoint();
             svgPoint.x = anchorLocalX;
             svgPoint.y = anchorLocalY;
             const transformedPoint = svgPoint.matrixTransform(this.group.getCTM());
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
             const rotateAnchorLocalX = parseFloat(this.rotationAnchor.getAttribute('cx'));
             const rotateAnchorLocalY = parseFloat(this.rotationAnchor.getAttribute('cy'));
             const svgPoint = svg.createSVGPoint();
             svgPoint.x = rotateAnchorLocalX;
             svgPoint.y = rotateAnchorLocalY;
             const transformedPoint = svgPoint.matrixTransform(this.group.getCTM());
             const rotateAnchorRadius = parseFloat(this.rotationAnchor.getAttribute('r'));
             const distSq = (x - transformedPoint.x)**2 + (y - transformedPoint.y)**2;
             if (distSq <= (rotateAnchorRadius + buffer)**2) {
                 return { type: 'rotate' };
             }
         }

         return null;
     }


    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }

    updatePosition(anchorIndex, newMouseX, newMouseY) {
        const CTM = this.group.getCTM();
        if (!CTM) return; 
        const inverseCTM = CTM.inverse();
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = newMouseX;
        svgPoint.y = newMouseY;
        const transformedPoint = svgPoint.matrixTransform(inverseCTM);
        let oldX = 0; 
        let oldY = 0; 
        let oldWidth = this.width;
        let oldHeight = this.height;

        let newLocalX = 0; 
        let newLocalY = 0; 
        let newWidth = oldWidth;
        let newHeight = oldHeight;

        switch (anchorIndex) {
            case 0: 
                newLocalX = transformedPoint.x;
                newLocalY = transformedPoint.y;
                newWidth = oldWidth - newLocalX;
                newHeight = oldHeight - newLocalY;
                break;
            case 1: 
                newLocalY = transformedPoint.y;
                newWidth = transformedPoint.x - oldX;
                newHeight = oldHeight - newLocalY;
                break;
            case 2: 
                newLocalX = transformedPoint.x;
                newWidth = oldWidth - newLocalX;
                newHeight = transformedPoint.y - oldY;
                break;
            case 3: 
                newWidth = transformedPoint.x - oldX;
                newHeight = transformedPoint.y - oldY;
                break;
            case 4: 
                newLocalY = transformedPoint.y;
                newHeight = oldHeight - newLocalY;
                break;
            case 5: 
                newHeight = transformedPoint.y - oldY;
                break;
            case 6: 
                newLocalX = transformedPoint.x;
                newWidth = oldWidth - newLocalX;
                break;
            case 7: 
                newWidth = transformedPoint.x - oldX;
                break;
        }
        if (newWidth < 0) {
            this.x += newLocalX + newWidth; 
            this.width = Math.abs(newWidth);
        } else {
             this.x += newLocalX; 
             this.width = newWidth;
        }

        if (newHeight < 0) {
            this.y += newLocalY + newHeight; 
            this.height = Math.abs(newHeight);
        } else {
            this.y += newLocalY; 
            this.height = newHeight;
        }

        
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

        fillStyleOptions.forEach(span => {
            const style = span.getAttribute("data-id");
            if (style === this.options.fillStyle) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
             }
        });

        squareStrokeThicknessValue.forEach(span => {
             const thickness = parseInt(span.getAttribute("data-id"));
            if (thickness === this.options.strokeWidth) {
                 span.classList.add("selected");
             } else {
                 span.classList.remove("selected");
             }
        });

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
        pushDeleteAction(currentShape);
        currentShape = null;
        disableAllSideBars();
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

        currentShape = new Rectangle(startX, startY, 0, 0, initialOptions);


    } else if (isSelectionToolActive) {
        let clickedOnShape = false;
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
            if (anchorInfo) {
                 dragOldPosSquare = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; // Save state before resize/rotate
                if (anchorInfo.type === 'resize') {
                    isResizingShapeSquare = true;
                    resizingAnchorIndexSquare = anchorInfo.index;
                } else if (anchorInfo.type === 'rotate') {
                    isRotatingShapeSquare = true;

                    const CTM = currentShape.group.getCTM();
                    if (CTM) {
                        const svgPoint = svg.createSVGPoint();
                        svgPoint.x = currentShape.width / 2;
                        svgPoint.y = currentShape.height / 2;
                        const centerSVG = svgPoint.matrixTransform(CTM);
                        startRotationMouseAngleSquare = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;
                        startShapeRotationSquare = currentShape.rotation;
                    } else {
                         isRotatingShapeSquare = false; 
                         console.warn("Could not get CTM for rotation.");
                    }
                }
                clickedOnShape = true;
            } else if (currentShape.contains(mouseX, mouseY)) {
                 isDraggingShapeSquare = true;
                 dragOldPosSquare = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; // Save state before drag
                 startX = mouseX; 
                 startY = mouseY;
                 clickedOnShape = true;
             }
        }

        if (!clickedOnShape) {
            let shapeToSelect = null;
            for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape.shapeName === 'rectangle' && shape.contains(mouseX, mouseY)) {
                    shapeToSelect = shape;
                    break; 
                }
            }
            if (currentShape && currentShape !== shapeToSelect) {
                 currentShape.removeSelection();
                 currentShape = null;
                 disableAllSideBars();
            }
            if (shapeToSelect) {
                currentShape = shapeToSelect;
                currentShape.isSelected = true;
                currentShape.draw(); 
                isDraggingShapeSquare = true; 
                dragOldPosSquare = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation }; 
                startX = mouseX; 
                startY = mouseY;
                clickedOnShape = true; 
            }
        }
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
    lastMousePos = {
        x: e.clientX - svgRect.left, 
        y: e.clientY - svgRect.top
    };

    if (isDrawingSquare && isSquareToolActive && currentShape) {
        let width = mouseX - startX;
        let height = mouseY - startY;
        currentShape.x = width < 0 ? startX + width : startX;
        currentShape.y = height < 0 ? startY + height : startY;
        currentShape.width = Math.abs(width);
        currentShape.height = Math.abs(height);
        currentShape.draw();
    } else if (isDraggingShapeSquare && currentShape && currentShape.isSelected) {
        const dx = mouseX - startX;
        const dy = mouseY - startY;
        currentShape.move(dx, dy); 
        startX = mouseX; 
        startY = mouseY;
        currentShape.draw(); 
    } else if (isResizingShapeSquare && currentShape && currentShape.isSelected && resizingAnchorIndexSquare !== null) {
        currentShape.updatePosition(resizingAnchorIndexSquare, mouseX, mouseY);
        currentShape.draw(); 
    } else if (isRotatingShapeSquare && currentShape && currentShape.isSelected) {
        const CTM = currentShape.group.getCTM();
        if (CTM) {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = currentShape.width / 2;
            svgPoint.y = currentShape.height / 2;
            const centerSVG = svgPoint.matrixTransform(CTM);
            const currentRotationMouseAngle = Math.atan2(mouseY - centerSVG.y, mouseX - centerSVG.x) * 180 / Math.PI;
            const angleDiff = currentRotationMouseAngle - startRotationMouseAngleSquare;
            let newRotation = startShapeRotationSquare + angleDiff;
             const snapAngle = 15;
             if (e.shiftKey) { 
                  newRotation = Math.round(newRotation / snapAngle) * snapAngle;
             }
            currentShape.rotate(newRotation);
            currentShape.draw(); 
            svg.style.cursor = 'grabbing'; 
        } else {
             isRotatingShapeSquare = false;
        }
    } else if (isSelectionToolActive && !isDrawingSquare && currentShape && currentShape.isSelected) {
          const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
           if (anchorInfo) {
               if (anchorInfo.type === 'resize') {
                   const baseDirection = anchorInfo.index; 
                   const rotatedCursor = currentShape.getRotatedCursor(baseDirection, currentShape.rotation);
                   svg.style.cursor = rotatedCursor + '-resize';
               } else if (anchorInfo.type === 'rotate') {
                    svg.style.cursor = 'grab';
               }
           } else if (currentShape.contains(mouseX, mouseY)) {
               svg.style.cursor = 'move';
           } else {
                svg.style.cursor = 'default';
           }
     } else if (isSelectionToolActive && !isDrawingSquare && !isDraggingShapeSquare && !isResizingShapeSquare && !isRotatingShapeSquare) {
         let hoveredShape = null;
         for (let i = shapes.length - 1; i >= 0; i--) {
             const shape = shapes[i];
             if (shape.shapeName === 'rectangle' && shape.contains(mouseX, mouseY)) {
                 hoveredShape = shape;
                 break;
             }
         }
         if (hoveredShape) {
             svg.style.cursor = 'pointer';
         } else {
             svg.style.cursor = 'default'; 
         }
    }
};

const handleMouseUp = (e) => {
    if (isDrawingSquare && currentShape) {
        if (currentShape.width === 0 || currentShape.height === 0) {
            if (currentShape.group.parentNode) {
                currentShape.group.parentNode.removeChild(currentShape.group);
            }
            currentShape = null;
        } else {
            shapes.push(currentShape);
            pushCreateAction(currentShape); 
        }
    }

    if ((isDraggingShapeSquare || isResizingShapeSquare || isRotatingShapeSquare) && dragOldPosSquare && currentShape) {
        const newPos = { x: currentShape.x, y: currentShape.y, width: currentShape.width, height: currentShape.height, rotation: currentShape.rotation };
        const stateChanged = dragOldPosSquare.x !== newPos.x || dragOldPosSquare.y !== newPos.y ||
                             dragOldPosSquare.width !== newPos.width || dragOldPosSquare.height !== newPos.height ||
                             dragOldPosSquare.rotation !== newPos.rotation;

        if (stateChanged) {
             pushTransformAction(currentShape, dragOldPosSquare, newPos);
        }
        dragOldPosSquare = null; 
    }

    isDrawingSquare = false;
    isDraggingShapeSquare = false;
    isResizingShapeSquare = false;
    isRotatingShapeSquare = false;
    resizingAnchorIndexSquare = null;
    startRotationMouseAngleSquare = 0;
    startShapeRotationSquare = 0;
    svg.style.cursor = 'default';
};

svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);
// document.addEventListener('mouseup', handleMouseUp);


SquarecolorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            pushOptionsChangeAction(currentShape, { ...currentShape.options }); 
            squareStrokecolor = span.getAttribute("data-id"); 
            currentShape.options.stroke = squareStrokecolor; 
            currentShape.draw();
            currentShape.updateSidebar(); 
        } else {
             squareStrokecolor = span.getAttribute("data-id");
        }
         SquarecolorOptions.forEach((el) => el.classList.remove("selected"));
         span.classList.add("selected"); 
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


function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneRectangleData(rect) {
    return {
        x: rect.x, 
        y: rect.y,
        width: rect.width,
        height: rect.height,
        options: cloneOptions(rect.options),
        rotation: rect.rotation
    };
}

let copiedShapeData = null;

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            copiedShapeData = cloneRectangleData(currentShape);
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

            let newX = pasteX - copiedShapeData.width / 2;
            let newY = pasteY - copiedShapeData.height / 2;
            newX += 10;
            newY += 10;
            shapes.forEach(shape => {
                if (shape.isSelected) {
                    shape.removeSelection(); 
                }
            });
            currentShape = null; 
            disableAllSideBars(); 
            const newRect = new Rectangle(
                newX,
                newY,
                copiedShapeData.width,
                copiedShapeData.height,
                cloneOptions(copiedShapeData.options) 
            );
            newRect.rotation = copiedShapeData.rotation; 
            shapes.push(newRect);
            newRect.isSelected = true;
            currentShape = newRect;
            newRect.draw(); 
            pushCreateAction(newRect); 
        }
    }
});