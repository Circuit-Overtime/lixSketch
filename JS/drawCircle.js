let circleStartX, circleStartY;
let currentCircle = null;
let isDrawingCircle = false;
let circleStrokeColor = "#fff";
let circleFillColor = "transparent";
let circleFillStyle = "none";
let circleStrokeThickness = 2;
let circleOutlineStyle = "solid";
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
            stroke: circleStrokeColor,
            strokeWidth: circleStrokeThickness,
            fill: circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor,
            fillStyle: circleFillStyle === "transparent" ? 'hachure' : circleFillStyle,
            strokeDasharray: circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : ""),
            ...options
        };
        this.element = null;
        this.overlay = null;
        this.group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.isSelected = false;
        this.anchors = [];
        this.selectionPadding = 8;
        this.selectionOutline = null;
        this.shapeName = 'circle';
        this.draw();

        this.group.addEventListener('mousedown', (e) => {
            if (isSelectionToolActive && !isDrawingCircle) {
                e.stopPropagation();
                this.select();
            }
        });
    }

    draw() {
        while (this.group.firstChild) {
            if (!this.group.firstChild.classList || (!this.group.firstChild.classList.contains('anchor') && this.group.firstChild !== this.selectionOutline)) {
                this.group.removeChild(this.group.firstChild);
            } else {
                break;
            }
        }

        if (this.element && this.element.parentNode === this.group) {
            this.group.removeChild(this.element);
            this.element = null;
        }

        if (this.overlay && this.overlay.parentNode === this.group) {
            this.group.removeChild(this.overlay);
            this.overlay = null;
        }

        const drawRadiusX = Math.max(1, this.radiusX);
        const drawRadiusY = Math.max(1, this.radiusY);

        const roughEllipse = rc.ellipse(this.centerX, this.centerY, drawRadiusX * 2, drawRadiusY * 2, this.options);
        this.element = roughEllipse;

        if (!this.overlay) {
            this.overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            this.overlay.setAttribute("fill", "rgba(0,0,0,0)");
            this.overlay.style.pointerEvents = "all";
            this.overlay.style.cursor = 'move';
        }
        this.overlay.setAttribute("x", this.centerX - drawRadiusX);
        this.overlay.setAttribute("y", this.centerY - drawRadiusY);
        this.overlay.setAttribute("width", drawRadiusX * 2);
        this.overlay.setAttribute("height", drawRadiusY * 2);

        if (this.group.firstChild) {
            this.group.insertBefore(this.overlay, this.group.firstChild);
            this.group.insertBefore(roughEllipse, this.overlay);
        } else {
            this.group.appendChild(roughEllipse);
            this.group.appendChild(this.overlay);
        }

        if (this.isSelected) {
            this.addAnchors();
        }
        this.group.setAttribute('data-shape-type', this.shapeName);
        if (!this.group.parentNode) {
            svg.appendChild(this.group);
        }
    }

    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;

        this.anchors.forEach(anchor => {
            if (anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });

        if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
            this.selectionOutline = null;
        }
        this.anchors = [];

        const expandedX = this.centerX - this.radiusX - this.selectionPadding;
        const expandedY = this.centerY - this.radiusY - this.selectionPadding;
        const expandedWidth = this.radiusX * 2 + 2 * this.selectionPadding;
        const expandedHeight = this.radiusY * 2 + 2 * this.selectionPadding;

        const positions = [
            { x: expandedX, y: expandedY },
            { x: expandedX + expandedWidth, y: expandedY },
            { x: expandedX, y: expandedY + expandedHeight },
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight },
            { x: expandedX + expandedWidth / 2, y: expandedY },
            { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight },
            { x: expandedX, y: expandedY + expandedHeight / 2 },
            { x: expandedX + expandedWidth, y: expandedY + expandedHeight / 2 }
        ];

        const anchorDirections = {
            0: 'nwse', 1: 'nesw', 2: 'nesw', 3: 'nwse',
            4: 'ns', 5: 'ns', 6: 'ew', 7: 'ew'
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

            anchor.addEventListener('mouseover', function() {
                const index = parseInt(this.getAttribute('data-index'));
                const baseDirection = anchorDirections[index];
                svg.style.cursor = baseDirection + '-resize';
            });
            anchor.addEventListener('mouseout', function() {
                svg.style.cursor = 'default';
            });

            this.group.appendChild(anchor);
            this.anchors[i] = anchor;
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
        outline.setAttribute('style', 'pointer-events: none;');
        this.group.appendChild(outline);
        this.selectionOutline = outline;
        disableAllSideBars();
        circleSideBar.classList.remove("hidden");
    }

    removeAnchors() {
        this.anchors.forEach(anchor => {
            if (anchor.parentNode === this.group) {
                this.group.removeChild(anchor);
            }
        });
        this.anchors = [];
        if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
            this.selectionOutline = null;
        }
        disableAllSideBars();
    }


    select() {
        shapes.forEach(shape => shape.deselect());
        this.isSelected = true;
        this.addAnchors();
        currentShape = this;
    }

    deselect() {
        if (this.isSelected) {
            this.isSelected = false;
            this.removeAnchors();
            currentShape = null;
        }
    }

    contains(x, y) {
        const checkRadiusX = Math.max(Number.EPSILON, this.radiusX);
        const checkRadiusY = Math.max(Number.EPSILON, this.radiusY);
        const normalizedX = (x - this.centerX) / checkRadiusX;
        const normalizedY = (y - this.centerY) / checkRadiusY;
        return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
    }

    move(dx, dy) {
        this.centerX += dx;
        this.centerY += dy;
        this.draw();
    }

    updatePosition(anchorIndex, newX, newY) {
        const originalCenterX = this.centerX;
        const originalCenterY = this.centerY;
        const originalRadiusX = this.radiusX;
        const originalRadiusY = this.radiusY;

        const originalNW_X = originalCenterX - originalRadiusX;
        const originalNW_Y = originalCenterY - originalRadiusY;
        const originalSE_X = originalCenterX + originalRadiusX;
        const originalSE_Y = originalCenterY + originalRadiusY;
        const originalNE_X = originalCenterX + originalRadiusX;
        const originalNE_Y = originalCenterY - originalRadiusY;
        const originalSW_X = originalCenterX - originalRadiusX;
        const originalSW_Y = originalCenterY + originalRadiusY;

        let newCenterX = originalCenterX;
        let newCenterY = originalCenterY;
        let newRadiusX = originalRadiusX;
        let newRadiusY = originalRadiusY;

        let fixedX, fixedY, newWidth, newHeight;
        const minSize = 1;

        switch (anchorIndex) {
            case 0: // NW
                fixedX = originalSE_X;
                fixedY = originalSE_Y;
                newWidth = Math.max(minSize * 2, fixedX - newX);
                newHeight = Math.max(minSize * 2, fixedY - newY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX - newRadiusX;
                newCenterY = fixedY - newRadiusY;
                break;

            case 1: // NE
                fixedX = originalSW_X;
                fixedY = originalSW_Y;
                newWidth = Math.max(minSize * 2, newX - fixedX);
                newHeight = Math.max(minSize * 2, fixedY - newY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX + newRadiusX;
                newCenterY = fixedY - newRadiusY;
                break;

            case 2: // SW
                fixedX = originalNE_X;
                fixedY = originalNE_Y;
                newWidth = Math.max(minSize * 2, fixedX - newX);
                newHeight = Math.max(minSize * 2, newY - fixedY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX - newRadiusX;
                newCenterY = fixedY + newRadiusY;
                break;

            case 3: // SE
                fixedX = originalNW_X;
                fixedY = originalNW_Y;
                newWidth = Math.max(minSize * 2, newX - fixedX);
                newHeight = Math.max(minSize * 2, newY - fixedY);
                newRadiusX = newWidth / 2;
                newRadiusY = newHeight / 2;
                newCenterX = fixedX + newRadiusX;
                newCenterY = fixedY + newRadiusY;
                break;

            case 4: // N-Mid
                fixedY = originalSE_Y;
                newHeight = Math.max(minSize * 2, fixedY - newY);
                newRadiusY = newHeight / 2;
                newCenterY = fixedY - newRadiusY;
                newCenterX = originalCenterX;
                newRadiusX = originalRadiusX;
                break;

            case 5: // S-Mid
                fixedY = originalNW_Y;
                newHeight = Math.max(minSize * 2, newY - fixedY);
                newRadiusY = newHeight / 2;
                newCenterY = fixedY + newRadiusY;
                newCenterX = originalCenterX;
                newRadiusX = originalRadiusX;
                break;

            case 6: // W-Mid
                fixedX = originalSE_X;
                newWidth = Math.max(minSize * 2, fixedX - newX);
                newRadiusX = newWidth / 2;
                newCenterX = fixedX - newRadiusX;
                newCenterY = originalCenterY;
                newRadiusY = originalRadiusY;
                break;

            case 7: // E-Mid
                fixedX = originalNW_X;
                newWidth = Math.max(minSize * 2, newX - fixedX);
                newRadiusX = newWidth / 2;
                newCenterX = fixedX + newRadiusX;
                newCenterY = originalCenterY;
                newRadiusY = originalRadiusY;
                break;
        }

        this.radiusX = newRadiusX;
        this.radiusY = newRadiusY;
        this.centerX = newCenterX;
        this.centerY = newCenterY;

        this.draw();
    }

    rotate(angle) {
        // Rotation for ellipses is complex and typically done via group transforms.
        // Implementing transform here is a placeholder if needed later.
    }
}

const handleMouseDown = (e) => {
    if (isCircleToolActive) {
        circleStartX = e.offsetX;
        circleStartY = e.offsetY;
        isDrawingCircle = true;
        shapes.forEach(shape => shape.deselect());
        currentCircle = new Circle(circleStartX, circleStartY, 0, 0, {
            stroke: circleStrokeColor,
            fill: circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor,
            fillStyle: circleFillStyle === "transparent" ? 'hachure' : circleFillStyle,
            strokeWidth: circleStrokeThickness,
            strokeDasharray: circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : "")
        });
        shapes.push(currentCircle);
        currentShape = currentCircle;
    } else if (isSelectionToolActive) {
        let shapeClicked = false;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            if (shape.contains(e.offsetX, e.offsetY)) {
                shape.select();
                shapeClicked = true;
                break;
            }
        }
        if (!shapeClicked) {
            shapes.forEach(shape => shape.deselect());
        }
    }
};

const handleMouseMove = (e) => {
    if (isDrawingCircle && isCircleToolActive && currentCircle) {
        const endX = e.offsetX;
        const endY = e.offsetY;

        const newCenterX = (circleStartX + endX) / 2;
        const newCenterY = (circleStartY + endY) / 2;
        const newRadiusX = Math.abs(endX - circleStartX) / 2;
        const newRadiusY = Math.abs(endY - circleStartY) / 2;

        currentCircle.centerX = newCenterX;
        currentCircle.centerY = newCenterY;
        currentCircle.radiusX = newRadiusX;
        currentCircle.radiusY = newRadiusY;

        currentCircle.draw();
    }
};

const handleMouseUp = (e) => {
    isDrawingCircle = false;
    currentCircle = null;
};

svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);

circleColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        circleColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleStrokeColor = span.getAttribute("data-id");
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            currentShape.options.stroke = circleStrokeColor;
            currentShape.draw();
        }
    });
});

circleFillColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        circleFillColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleFillColor = span.getAttribute("data-id");
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            currentShape.options.fill = circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor;
            currentShape.draw();
        }
    });
});

circleFillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        circleFillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleFillStyle = span.getAttribute("data-id");
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            currentShape.options.fillStyle = circleFillStyle === "transparent" ? 'hachure' : circleFillStyle;
            currentShape.options.fill = circleFillColor === "transparent" ? "rgba(0,0,0,0)" : circleFillColor;
            currentShape.draw();
        }
    });
});

circleStrokeThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        circleStrokeThicknessOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleStrokeThickness = parseInt(span.getAttribute("data-id"));
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            currentShape.options.strokeWidth = circleStrokeThickness;
            currentShape.draw();
        }
    });
});

circleOutlineStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        circleOutlineStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        circleOutlineStyle = span.getAttribute("data-id");
        if (currentShape && currentShape.shapeName === 'circle' && currentShape.isSelected) {
            currentShape.options.strokeDasharray = circleOutlineStyle === "dashed" ? "10,10" : (circleOutlineStyle === "dotted" ? "2,8" : "");
            currentShape.draw();
        }
    });
});