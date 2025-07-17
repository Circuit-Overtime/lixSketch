import { pushCreateAction, pushDeleteAction, pushOptionsChangeAction, pushTransformAction } from './undoAndRedo.js';
let isDrawingCircle = false;
let isDraggingShapeCircle = false;
let isResizingShapeCircle = false;
let isRotatingShapeCircle = false;
let resizingAnchorIndexCircle = null;

let startRotationMouseAngleCircle = null;
let startShapeRotationCircle = null;
const rc = rough.svg(svg);
let startX, startY;


let circleStrokecolor = "#fff";
let circleBackgroundColor = "transparent";
let circleFillStyleValue = "none";
let circleStrokeThicknes = 2;
let circleOutlineStyle = "solid";

let dragOldPosCircle = null;
let copiedShapeData = null;

let colorOptionsCircle = document.querySelectorAll(".circleStrokeSpan");
let backgroundColorOptionsCircle = document.querySelectorAll(".circleBackgroundSpan");
let fillStyleOptionsCircle = document.querySelectorAll(".circleFillStyleSpan");
let strokeThicknessValueCircle = document.querySelectorAll(".circleStrokeThickSpan");
let outlineStyleValueCircle = document.querySelectorAll(".circleOutlineStyle");

class Circle {
    constructor(x, y, rx, ry, options = {}) {
        this.x = x; 
        this.y = y; 
        this.rx = rx; 
        this.ry = ry; 
        this.options = {
            roughness: 1.5,
            stroke: circleStrokecolor,
            strokeWidth: circleStrokeThicknes,
            fill: circleBackgroundColor,
            fillStyle: circleFillStyleValue,
            strokeDasharray: circleOutlineStyle === "dashed" ? "5,5" : (circleOutlineStyle === "dotted" ? "2,8" : ""),
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
        this.shapeName = "circle";
        if(!this.group.parentNode) {
            svg.appendChild(this.group);
        }
        this._lastDrawn = {
            width: null,
            height: null,
            options: null
        };
        this.draw();
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
        if (isInitialDraw || optionsChanged) {
            if (this.element && this.element.parentNode === this.group) {
                this.group.removeChild(this.element);
            }
            
            const roughEllipse = rc.ellipse(0, 0, this.rx * 2, this.ry * 2, this.options);
            this.element = roughEllipse;
            this.group.appendChild(roughEllipse);

            this._lastDrawn.rx = this.rx;
            this._lastDrawn.ry = this.ry;
            this._lastDrawn.options = optionsString;
        }

        this.group.setAttribute('transform', `translate(${this.x}, ${this.y}) rotate(${this.rotation}, 0, 0)`);
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
        const expandedX = -this.rx - this.selectionPadding;
        const expandedY = -this.ry - this.selectionPadding; 
        const expandedWidth = this.rx * 2 + 2 * this.selectionPadding;
        const expandedHeight = this.ry * 2 + 2 * this.selectionPadding;

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
                 if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
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
             if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
                 svg.style.cursor = 'grab';
             }
        });
        this.rotationAnchor.addEventListener('mouseout', function () {
            if (!isResizingShapeCircle && !isDraggingShapeCircle && !isRotatingShapeCircle) {
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

        disableAllSideBars();
        circleSideBar.classList.remove("hidden");
        this.updateSidebar();
    }

        removeSelection() {
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

        const dx = transformedPoint.x - 0; 
        const dy = transformedPoint.y - 0;
        const rx = this.rx;
        const ry = this.ry;
        return ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry)) <= 1.05; 
    }
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
        let oldWidth = this.rx * 2;
        let oldHeight = this.ry * 2;

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
            this.radius = Math.abs(newHeight);
        } else {
            this.y += newLocalY; 
            this.radius = newHeight;
        }   
    }
    rotate(angle) {
        angle = angle % 360;
        if (angle < 0) angle += 360;
        this.rotation = angle;
    }
    updateSidebar() 
    {
        colorOptionsCircle.forEach(span => {
            const color = span.getAttribute('data-id');
            if (color === this.options.stroke) {
            span.classList.add('selected');
            } else {
            span.classList.remove('selected');
            }
        });

        backgroundColorOptionsCircle.forEach(span => {
            const color = span.getAttribute('data-id');
            if (color === this.options.fill) {
            span.classList.add('selected');
            } else {
            span.classList.remove('selected');
            }
        });

        fillStyleOptionsCircle.forEach(span => {
            const style = span.getAttribute('data-id');
            if (style === this.options.fillStyle) {
            span.classList.add('selected');
            } else {
            span.classList.remove('selected');
            }
        });

        strokeThicknessValueCircle.forEach(span => {
            const thick = parseInt(span.getAttribute('data-id'), 10);
            if (thick === this.options.strokeWidth) {
            span.classList.add('selected');
            } else {
            span.classList.remove('selected');
            }
        });

        outlineStyleValueCircle.forEach(span => {
            const style = span.getAttribute('data-id');
            let currentStyle = "solid";
            if (this.options.strokeDasharray === "5,5") currentStyle = "dashed";
            else if (this.options.strokeDasharray === "2,8") currentStyle = "dotted";
            if (style === currentStyle) {
            span.classList.add('selected');
            } else {
            span.classList.remove('selected');
            }
        });
    }

}


function getSVGCoordsFromMouse(e) {
    const viewBox = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const svgX = viewBox.x + (mouseX / rect.width) * viewBox.width;
    const svgY = viewBox.y + (mouseY / rect.height) * viewBox.height;
    return { x: svgX, y: svgY };
}


function deleteCurrentShape() {
    if (currentShape && currentShape.shapeName === 'circle') {
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

    if(isCircleToolActive)
    {
        const {x,y} = getSVGCoordsFromMouse(e);
        startX = x;
        startY = y;
        isDrawingCircle = true;

        if(currentShape) 
        {
            currentShape.removeSelection();
            currentShape = null;
            disableAllSideBars();
        }
        let initialOptions = {
            stroke: circleStrokecolor,
            fill: circleBackgroundColor,
            fillStyle: circleFillStyleValue,
            strokeWidth: circleStrokeThicknes,
        };
        if(circleOutlineStyle === "dashed") {
            initialOptions.strokeDasharray = "5,5";
        }
        else if(circleOutlineStyle === "dotted") {
            initialOptions.strokeDasharray = "2,8";
        } else {
            initialOptions.strokeDasharray = "";
        }

        currentShape = new Circle(startX, startY, 0, 0, initialOptions);
    }

    else if(isSelectionToolActive) 
    {
        let clickedOnShape = false;
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected)
        {
            const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
            if (anchorInfo) {
                dragOldPosCircle = { x: currentShape.x, y: currentShape.y };
                if(anchorInfo.type === 'resize') 
                {
                    isResizingShapeCircle = true;
                    resizingAnchorIndexCircle = anchorInfo.index;
                }
                else if(anchorInfo.type === 'rotate') 
                {
                    isRotatingShapeCircle = true;
                    const CTM = currentShape.group.getCTM();
                    if(CTM)
                    {
                        const svgPoint = svg.createSVGPoint();
                        svgPoint.x = currentShape.rx;
                        svgPoint.y = currentShape.ry;
                        const centerSVGPoint = svgPoint.matrixTransform(CTM);
                        startRotationMouseAngleCircle = Math.atan2(mouseY - centerSVGPoint.y, mouseX - centerSVGPoint.x) * (180 / Math.PI);
                        startShapeRotationCircle = currentShape.rotation;
                    }
                    else 
                    {
                        isRotatingShapeCircle = false;
                    }
                }
                clickedOnShape = true;
            }
            else if (currentShape.contains(mouseX, mouseY)) 
            {
                isDraggingShapeCircle = true;
                dragOldPosCircle = { x: currentShape.x, y: currentShape.y };
                startX = mouseX;
                startY = mouseY;
                clickedOnShape = true;
            }
    }
    if (!clickedOnShape) 
    {
        let shapeToSelect = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
                const shape = shapes[i];
                if (shape.shapeName === 'circle' && shape.contains(mouseX, mouseY)) {
                    shapeToSelect = shape;
                    break; 
                }
            }
            if (currentShape && currentShape !== shapeToSelect) {
                 currentShape.removeSelection();
                 currentShape = null;
                 disableAllSideBars();
            }
            if(shapeToSelect)
            {
                currentShape = shapeToSelect;
                currentShape.isSelected = true;
                currentShape.draw();
                isDraggingShapeCircle = true;
                dragOldPosCircle = { x: currentShape.x, y: currentShape.y };
                startX = mouseX;
                startY = mouseY;
                clickedOnShape = true;
            }
    }
    if(!clickedOnShape && currentShape) {
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
    if(isDrawingCircle && isCircleToolActive && currentShape)   
    {
        const {x: mouseX, y: mouseY} = getSVGCoordsFromMouse(e);
        currentShape.x = (startX + mouseX) / 2;
        currentShape.y = (startY + mouseY) / 2;
        currentShape.rx = Math.abs(mouseX - startX) / 2;
        currentShape.ry = Math.abs(mouseY - startY) / 2;
        currentShape.draw();
    }
    else if (isDraggingShapeCircle && currentShape && currentShape.isSelected) {
        const dx = mouseX - startX;
        const dy = mouseY - startY;
        currentShape.move(dx, dy);
        startX = mouseX;
        startY = mouseY;
        currentShape.draw();
    }   
    else if(isResizingShapeCircle && currentShape && currentShape.isSelected) 
    {
        currentShape.updatePosition(resizingAnchorIndexCircle, mouseX, mouseY);
        currentShape.draw();
    }
    else if (isRotatingShapeCircle && currentShape && currentShape.isSelected) 
    { 
        const CTM = currentShape.group.getCTM();
        if(CTM) {
            const svgPoint = svg.createSVGPoint();
            svgPoint.x = currentShape.rx;
            svgPoint.y = currentShape.ry;
            const centerSVGPoint = svgPoint.matrixTransform(CTM);
            const currentMouseAngle = Math.atan2(mouseY - centerSVGPoint.y, mouseX - centerSVGPoint.x) * (180 / Math.PI);
            const angleDiff = currentMouseAngle - startRotationMouseAngleCircle;
            const newRotation = startShapeRotationCircle + angleDiff;
            const snapAngle = 15;
             if (e.shiftKey) { 
                  newRotation = Math.round(newRotation / snapAngle) * snapAngle;
             }
            currentShape.rotate(newRotation);
            currentShape.draw(); 
            svg.style.cursor = 'grabbing'; 
        }
        else 
        {
            isRotatingShapeCircle = false; 
            svg.style.cursor = 'default';
        }
    }
    else if (isSelectionToolActive && !isDrawingCircle && currentShape && currentShape.isSelected) 
    {
        const anchorInfo = currentShape.isNearAnchor(mouseX, mouseY);
        if(anchorInfo)
        {
            if(anchorInfo.type === 'resize') {
                const baseDirection = anchorInfo.index; 
                const rotatedCursor = currentShape.getRotatedCursor(baseDirection, currentShape.rotation);
                svg.style.cursor = rotatedCursor + '-resize';
            }
            else if(anchorInfo.type === 'rotate') {
                svg.style.cursor = 'grab';
            }
            else if(currentShape.contains(mouseX, mouseY)) {
                svg.style.cursor = 'move';
            }
            else 
            {
                svg.style.cursor = 'default';
            }
        }
    }

    else if (isSelectionToolActive && !isDrawingCircle && !isDraggingShapeCircle && !isResizingShapeCircle && !isRotatingShapeCircle) 
    {
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
    }
}

const handleMouseUp = (e) => {
    if (isDrawingCircle && currentShape) 
    {
        if(currentShape.rx === 0 && currentShape.ry === 0)
        {
            if (currentShape.group.parentNode) {
                currentShape.group.parentNode.removeChild(currentShape.group);
            }
            currentShape = null;
        }
        else 
        {
            shapes.push(currentShape);
            pushCreateAction(currentShape);
        }
        
    }
    if((isDraggingShapeCircle || isResizingShapeCircle || isRotatingShapeCircle) && dragOldPosCircle && currentShape) 
    {
        const newPos = { x: currentShape.x, y: currentShape.y, rx: currentShape.rx, ry: currentShape.ry, rotation: currentShape.rotation };
        const stateChanged = dragOldPosCircle.x !== newPos.x || dragOldPosCircle.y !== newPos.y ||
                              dragOldPosCircle.rx !== newPos.rx || dragOldPosCircle.ry !== newPos.ry || dragOldPosCircle.rotation !== newPos.rotation;
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
    startRotationMouseAngleCircle = null;
    startShapeRotationCircle = 0;
    svg.style.cursor = 'default';
}

svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);

colorOptionsCircle.forEach(span => {
    span.addEventListener('click', function(event) {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            const color = this.getAttribute('data-id');
            currentShape.options.stroke = color;
            currentShape.draw();
            currentShape.updateSidebar();
            pushOptionsChangeAction(currentShape, {...currentShape.options });

        }
        else 
        {
            circleStrokecolor = this.getAttribute('data-id');
        }
        colorOptionsCircle.forEach(span => {
            span.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});
backgroundColorOptionsCircle.forEach(span => {
    span.addEventListener('click', function(event) {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            const color = this.getAttribute('data-id');
            currentShape.options.fill = color;
            currentShape.draw();
            currentShape.updateSidebar();
            pushOptionsChangeAction(currentShape, {...currentShape.options });
        }
        else 
        {
            circleBackgroundColor = this.getAttribute('data-id');
        }
        backgroundColorOptionsCircle.forEach(span => {
            span.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});
fillStyleOptionsCircle.forEach(span => {
    span.addEventListener('click', function(event) {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            const style = this.getAttribute('data-id');
            currentShape.options.fillStyle = style;
            currentShape.draw();
            currentShape.updateSidebar();
            pushOptionsChangeAction(currentShape, {...currentShape.options });
        }
        else 
        {
            circleFillStyleValue = this.getAttribute('data-id');
        }
        fillStyleOptionsCircle.forEach(span => {
            span.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});
strokeThicknessValueCircle.forEach(span => {
    span.addEventListener('click', function(event) {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            const thick = parseInt(this.getAttribute('data-id'), 10);
            currentShape.options.strokeWidth = thick;
            currentShape.draw();
            currentShape.updateSidebar();
            pushOptionsChangeAction(currentShape, {...currentShape.options });
        }
        else 
        {
            circleStrokeThicknes = parseInt(this.getAttribute('data-id'), 10);
        }
        strokeThicknessValueCircle.forEach(span => {
            span.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});
outlineStyleValueCircle.forEach(span => {
    span.addEventListener('click', function(event) {
        event.stopPropagation();
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            const style = this.getAttribute('data-id');
            if (style === "dashed") {
                currentShape.options.strokeDasharray = "5,5";
            } else if (style === "dotted") {
                currentShape.options.strokeDasharray = "2,8";
            } else {
                currentShape.options.strokeDasharray = "";
            }
            currentShape.draw();
            currentShape.updateSidebar();
            pushOptionsChangeAction(currentShape, {...currentShape.options });
        }
        else 
        {
            circleOutlineStyle = this.getAttribute('data-id');
        }
        outlineStyleValueCircle.forEach(span => {
            span.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});

function cloneOptions(options) {
    return JSON.parse(JSON.stringify(options));
}

function cloneCircleData(circle) {
    return {
        x: circle.x,
        y: circle.y,
        rx: circle.rx,
        ry: circle.ry,
        rotation: circle.rotation,
        options: cloneOptions(circle.options)
    };
}

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            copiedShapeData = cloneCircleData(currentShape);
        }
    }
});


document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedShapeData) {
            e.preventDefault(); 
            let pasteX, pasteY;
            if (lastMousePos && typeof lastMousePos.x === 'number' && typeof lastMousePos.y === 'number') 
            {
                const svgPoint = svg.createSVGPoint();
                svgPoint.x = lastMousePos.x;
                svgPoint.y = lastMousePos.y;
                const CTM = svg.getScreenCTM().inverse();
                const userPoint = svgPoint.matrixTransform(CTM);
                pasteX = userPoint.x;
                pasteY = userPoint.y;
            }
            else 
            {
                const svgCircle = svg.getBoundingClientRect();
                pasteX = svgCircle.width / 2;
                pasteY = svgCircle.height / 2;
                const svgPoint = svg.createSVGPoint();
                svgPoint.x = pasteX;
                svgPoint.y = pasteY;
                const CTM = svg.getScreenCTM().inverse();
                const userPoint = svgPoint.matrixTransform(CTM);
                pasteX = userPoint.x;
                pasteY = userPoint.y;
            }

            let newX = pasteX - copiedShapeData.radius;
            let newY = pasteY - copiedShapeData.radius;
            newX += 10;
            newY += 10;
            shapes.forEach(shape => {
                if(shape.isSelected)
                {
                    shape.removeSelection();
                }
            })
            currentShape = null;
            disableAllSideBars();
            const newCircle = new Circle(
                newX, 
                newY, 
                copiedShapeData.radius, 
                cloneOptions(copiedShapeData.options)
            );
            newCircle.rotation = copiedShapeData.rotation;
            shapes.push(newCircle);
            newCircle.isSelected = true;
            currentShape = newCircle;
            newCircle.draw()
            pushCreateAction(newCircle);
            newCircle.addAnchors();

        }
    }
});