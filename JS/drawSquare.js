let isDrawingSquare = false;
const rc = rough.svg(svg); 
let startX, startY;
let squareStrokecolor = "#fff";
let squareBackgroundColor = "transparent";
let squareFillStyleValue = "none";
let squareStrokeThicknes = 2;
let squareOutlineStyle = "solid";
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
        this.draw();
    }

    draw() {
        while (this.group.firstChild) {
            this.group.removeChild(this.group.firstChild);
        }
        if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
            this.group.removeChild(this.selectionOutline);
            this.selectionOutline = null;
        }
        const roughRect = rc.rectangle(this.x, this.y, this.width, this.height, this.options);
        this.element = roughRect;
        this.group.appendChild(roughRect);

        this.group.setAttribute('transform', `rotate(${this.rotation} ${this.x + this.width / 2} ${this.y + this.height / 2})`);
        this.group.setAttribute('data-shape', this.shapeName);
        if (this.isSelected) {
            this.addAnchors();
        }

        svg.appendChild(this.group);
    }

    getRotatedCursor(direction, angle) {
        const directions = ['ns', 'nesw', 'ew', 'nwse'];
        const angleToIndex = {
            'ns': 0,
            'nesw': 1,
            'ew': 2,
            'nwse': 3
        };

        const baseIndex = angleToIndex[direction];
        const steps = Math.round((angle % 360) / 45) % 8;
        const rotatedIndex = (baseIndex + Math.floor(steps / 2)) % 4;

        return directions[rotatedIndex];
    }

    addAnchors() {
        const anchorSize = 10;
        const anchorStrokeWidth = 2;
        const self = this;

        const expandedX = this.x - this.selectionPadding;
        const expandedY = this.y - this.selectionPadding;
        const expandedWidth = this.width + 2 * this.selectionPadding;
        const expandedHeight = this.height + 2 * this.selectionPadding;

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
            0: 'nwse',
            1: 'nesw',
            2: 'nesw',
            3: 'nwse',
            4: 'ns',
            5: 'ns',
            6: 'ew',
            7: 'ew'
        };

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
        this.anchors = [];

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
                const index = parseInt(this.getAttribute('data-index'));
                const baseDirection = anchorDirections[index];
                const rotatedCursor = self.getRotatedCursor(baseDirection, self.rotation);
                svg.style.cursor = rotatedCursor + '-resize';
            });

            anchor.addEventListener('mouseout', function () {
                svg.style.cursor = 'default';
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
            svg.style.cursor = 'grab';
        });
        this.rotationAnchor.addEventListener('mouseout', function () {
            svg.style.cursor = 'default';
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
        console.log(this.shapeName)
        disableAllSideBars();
        squareSideBar.classList.remove("hidden");
        }
    
        select() {
            // Deselect all other shapes if needed (optional, handled elsewhere)
            this.isSelected = true;
            this.addAnchors();
            // Show the sidebar for rectangle
            disableAllSideBars && disableAllSideBars();
            squareSideBar && squareSideBar.classList.remove("hidden");
        }
        
    deselect() {
        if (this.isSelected) {
            this.isSelected = false;
            // Remove anchors and selection outline if present
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
            if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
                this.group.removeChild(this.rotationAnchor);
                this.rotationAnchor = null;
            }
            // Hide sidebar if needed
            disableAllSideBars && disableAllSideBars();
        }
    }

    contains(x, y) {
        const rectCenterX = this.x + this.width / 2;
        const rectCenterY = this.y + this.height / 2;

        const dx = x - rectCenterX;
        const dy = y - rectCenterY;

        const rotatedX = dx * Math.cos(-this.rotation * Math.PI / 180) - dy * Math.sin(-this.rotation * Math.PI / 180) + rectCenterX;
        const rotatedY = dx * Math.sin(-this.rotation * Math.PI / 180) + dy * Math.cos(-this.rotation * Math.PI / 180) + rectCenterY;

        return rotatedX >= this.x && rotatedX <= this.x + this.width &&
               rotatedY >= this.y && rotatedY <= this.y + this.height;
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        this.draw();
    }

    updatePosition(anchorIndex, newX, newY) {
        const rectCenterX = this.x + this.width / 2;
        const rectCenterY = this.y + this.height / 2;
        const inverseRotation = -this.rotation * Math.PI / 180;

        const dx = newX - rectCenterX;
        const dy = newY - rectCenterY;

        const rotatedDX = dx * Math.cos(inverseRotation) - dy * Math.sin(inverseRotation);
        const rotatedDY = dx * Math.sin(inverseRotation) + dy * Math.cos(inverseRotation);

        const transformedX = rotatedDX + rectCenterX;
        const transformedY = rotatedDY + rectCenterY;

        switch (anchorIndex) {
            case 0: this.width += this.x - transformedX; this.height += this.y - transformedY; this.x = transformedX; this.y = transformedY; break;
            case 1: this.width = transformedX - this.x; this.height += this.y - transformedY; this.y = transformedY; break;
            case 2: this.width += this.x - transformedX; this.height = transformedY - this.y; this.x = transformedX; break;
            case 3: this.width = transformedX - this.x; this.height = transformedY - this.y; break;
            case 4: this.height += this.y - transformedY; this.y = transformedY; break;
            case 5: this.height = transformedY - this.y; break;
            case 6: this.width += this.x - transformedX; this.x = transformedX; break;
            case 7: this.width = transformedX - this.x; break;
        }

        if (this.width < 0) {
            this.x = this.x + this.width;
            this.width = Math.abs(this.width);
        }
        if (this.height < 0) {
            this.y = this.y + this.height;
            this.height = Math.abs(this.height);
        }

        this.draw();
    }

    rotate(angle) {
        this.rotation = angle;
        this.draw();
    }
}

const handleMouseDown = (e) => {
    if (isSquareToolActive) {
        startX = e.offsetX;
        startY = e.offsetY;
        isDrawingSquare = true;
        let initialOptions = {};
        if (isSquareToolActive) {
            initialOptions = {
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
        }

        currentShape = new Rectangle(startX, startY, 0, 0, initialOptions);
        shapes.push(currentShape);
    } else if (isSelectionToolActive) {
    }
};

const handleMouseMove = (e) => {
    if (isDrawingSquare && isSquareToolActive && currentShape) {
        currentShape.width = e.offsetX - startX;
        currentShape.height = e.offsetY - startY;
        currentShape.draw();
    } else if (isSelectionToolActive) {
        
    }
};

const handleMouseUp = (e) => {
    isDrawingSquare = false;

};


svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);




SquarecolorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        SquarecolorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokecolor = span.getAttribute("data-id");
        console.log("Selected Square Stroke Color:", squareStrokecolor);

        // Update selected rectangle if any
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            currentShape.options.stroke = squareStrokecolor;
            currentShape.draw();
        }
    });
});

backgroundColorOptionsSquare.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        backgroundColorOptionsSquare.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareBackgroundColor = span.getAttribute("data-id");
        console.log("Selected Square Background Color:", squareBackgroundColor);

        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            currentShape.options.fill = squareBackgroundColor;
            currentShape.draw();
        }
    });
});

fillStyleOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        fillStyleOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareFillStyleValue = span.getAttribute("data-id");
        console.log("Selected Square Fill Style:", squareFillStyleValue);
        
        if(currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            currentShape.options.fillStyle = squareFillStyleValue;
            currentShape.draw();
        }
    });
});


squareStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation()
        squareStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareStrokeThicknes = parseInt(span.getAttribute("data-id"));
        console.log("Selected Square Stroke Thickness:", squareStrokeThicknes);
        
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            currentShape.options.strokeWidth = squareStrokeThicknes;
            currentShape.draw();
        }
    });
});


squareOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        squareOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        squareOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Square Outline Style:", squareOutlineStyle);
        
        if (currentShape && currentShape.shapeName === 'rectangle' && currentShape.isSelected) {
            if (squareOutlineStyle === "dashed") {
                currentShape.options.strokeDasharray = "10,10";
            } else if (squareOutlineStyle === "dotted") {
                currentShape.options.strokeDasharray = "2,8";
            } else {
                currentShape.options.strokeDasharray = "";
            }
            currentShape.draw();
        }
    });
});




