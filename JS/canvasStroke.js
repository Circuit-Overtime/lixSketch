import { SelectionManager } from './selectionManager.js';
const selectionManager = new SelectionManager(svg, shapes);


const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");
let strokeColor = "#fff";
let strokeThickness = 2;
let points = [];
let isDrawingStroke = false;
let currentStroke = null;



function getSvgCoordinates(event) {
  const rect = svg.getBoundingClientRect();
  const scaleX = currentViewBox.width / rect.width;
  const scaleY = currentViewBox.height / rect.height;

  const svgX = currentViewBox.x + (event.clientX - rect.left) * scaleX;
  const svgY = currentViewBox.y + (event.clientY - rect.top) * scaleY;

  return { x: svgX, y: svgY };
}

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return '';
  const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
          const [x1, y1] = arr[i + 1] || arr[i];
          acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          return acc;
      },
      ['M', ...stroke[0], 'Q']
  );
  d.push('Z');
  return d.join(' ');
}


class FreehandStroke {
  constructor(points = [], options = {}) {
    this.points = points;
    this.options = {
        stroke: strokeColor,
        strokeWidth: strokeThickness,
        fill: "none",
        strokeLinecap: "round",
        strokeLinejoin: "round",
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
    this.boundingBox = { x: 0, y: 0, width: 0, height: 0 };
    this.draw();
  }

  // Convert points to SVG path data
  getPathData() {
    if (this.points.length < 2) return '';
    const stroke = getStroke(this.points, {
        size: this.options.strokeWidth,
        thinning: 0.5,
        smoothing: 0.8,
        streamline: 0.2,
        easing: (t) => t,
        start: { taper: 0, easing: (t) => t, cap: true },
        end: { taper: 0, easing: (t) => t, cap: true },
        simulatePressure: true
    });
    return getSvgPathFromStroke(stroke);
}

  // Calculate the bounding box of the stroke
  calculateBoundingBox() {
    if (this.points.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    this.points.forEach(point => {
        minX = Math.min(minX, point[0]);
        minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]);
        maxY = Math.max(maxY, point[1]);
    });
    
    // Ensure we have valid dimensions
    if (minX === Infinity || minY === Infinity) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    
    // Add padding for stroke width
    const padding = this.options.strokeWidth / 2;
    return {
        x: minX - padding,
        y: minY - padding,
        width: Math.max(0, (maxX - minX) + padding * 2),
        height: Math.max(0, (maxY - minY) + padding * 2)
    };
}

  draw() {
    while (this.group.firstChild) {
        this.group.removeChild(this.group.firstChild);
    }

    if (this.selectionOutline && this.selectionOutline.parentNode === this.group) {
        this.group.removeChild(this.selectionOutline);
        this.selectionOutline = null;
    }

    // Create the path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', this.getPathData());
    path.setAttribute('stroke', this.options.stroke);
    path.setAttribute('stroke-width', this.options.strokeWidth);
    path.setAttribute('fill', this.options.fill);
    path.setAttribute('stroke-linecap', this.options.strokeLinecap);
    path.setAttribute('stroke-linejoin', this.options.strokeLinejoin);
    this.element = path;
    this.group.appendChild(path);

    // Calculate and store bounding box
    this.boundingBox = this.calculateBoundingBox();

    // Apply rotation
    const centerX = this.boundingBox.x + this.boundingBox.width / 2;
    const centerY = this.boundingBox.y + this.boundingBox.height / 2;

    // Ensure centerX and centerY are valid numbers
    if (!isNaN(centerX) && !isNaN(centerY)) {
        this.group.setAttribute('transform', `rotate(${this.rotation} ${centerX} ${centerY})`);
    } else {
        console.error("Invalid bounding box values for rotation:", this.boundingBox);
    }

    if (this.isSelected) {
        this.addAnchors();
    }

    svg.appendChild(this.group);
}




  contains(x, y) {
      // Simple bounding box check (could implement more accurate hit testing)
      const centerX = this.boundingBox.x + this.boundingBox.width / 2;
      const centerY = this.boundingBox.y + this.boundingBox.height / 2;
      
      // Adjust for rotation
      const dx = x - centerX;
      const dy = y - centerY;
      
      const angleRad = -this.rotation * Math.PI / 180;
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX;
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY;
      
      return rotatedX >= this.boundingBox.x && 
             rotatedX <= this.boundingBox.x + this.boundingBox.width &&
             rotatedY >= this.boundingBox.y && 
             rotatedY <= this.boundingBox.y + this.boundingBox.height;
  }

  move(dx, dy) {
      this.points = this.points.map(point => [point[0] + dx, point[1] + dy]);
      this.draw();
  }

  addAnchors() {
      const anchorSize = 10;
      const anchorStrokeWidth = 2;
      const self = this;
      
      const expandedX = this.boundingBox.x - this.selectionPadding;
      const expandedY = this.boundingBox.y - this.selectionPadding;
      const expandedWidth = this.boundingBox.width + 2 * this.selectionPadding;
      const expandedHeight = this.boundingBox.height + 2 * this.selectionPadding;
      
      const positions = [
          { x: expandedX, y: expandedY }, // top-left
          { x: expandedX + expandedWidth, y: expandedY }, // top-right
          { x: expandedX, y: expandedY + expandedHeight }, // bottom-left
          { x: expandedX + expandedWidth, y: expandedY + expandedHeight }, // bottom-right
          { x: expandedX + expandedWidth / 2, y: expandedY }, // top-center
          { x: expandedX + expandedWidth / 2, y: expandedY + expandedHeight }, // bottom-center
          { x: expandedX, y: expandedY + expandedHeight / 2 }, // left-center
          { x: expandedX + expandedWidth, y: expandedY + expandedHeight / 2 } // right-center
      ];
      
      // Remove existing anchors
      this.anchors.forEach(anchor => {
          if (anchor.parentNode === this.group) {
              this.group.removeChild(anchor);
          }
      });
      if (this.rotationAnchor && this.rotationAnchor.parentNode === this.group) {
          this.group.removeChild(this.rotationAnchor);
      }
      this.anchors = [];
      
      // Create resize anchors
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
              const directions = ['nwse', 'nesw', 'ew', 'nwse', 'ns', 'ns', 'ew', 'ew'];
              svg.style.cursor = directions[i] + '-resize';
          });
          
          anchor.addEventListener('mouseout', function() {
              svg.style.cursor = 'default';
          });
          
          this.group.appendChild(anchor);
          this.anchors[i] = anchor;
      });
      

      
      // Create selection outline
      const outlinePoints = [
          [expandedX, expandedY],
          [expandedX + expandedWidth, expandedY],
          [expandedX + expandedWidth, expandedY + expandedHeight],
          [expandedX, expandedY + expandedHeight],
          [expandedX, expandedY]
      ];
      
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      outline.setAttribute('points', outlinePoints.map(p => p.join(',')).join(' '));
      outline.setAttribute('fill', 'none');
      outline.setAttribute('stroke', '#5B57D1');
      outline.setAttribute('stroke-width', 1.5);
      outline.setAttribute('stroke-dasharray', '4 2');
      outline.setAttribute('style', 'pointer-events: none;');
      this.group.appendChild(outline);
      this.selectionOutline = outline;
  }

  updatePosition(anchorIndex, newX, newY) {
      const centerX = this.boundingBox.x + this.boundingBox.width / 2;
      const centerY = this.boundingBox.y + this.boundingBox.height / 2;
      const angleRad = -this.rotation * Math.PI / 180;
      
      // Convert new coordinates to unrotated space
      const dx = newX - centerX;
      const dy = newY - centerY;
      const rotatedX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad) + centerX;
      const rotatedY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad) + centerY;
      
      // Calculate scale factors based on anchor movement
      let scaleX = 1, scaleY = 1;
      switch(anchorIndex) {
          case 0: // top-left
              scaleX = (centerX - rotatedX) / (centerX - this.boundingBox.x);
              scaleY = (centerY - rotatedY) / (centerY - this.boundingBox.y);
              break;
          case 1: // top-right
              scaleX = (rotatedX - centerX) / (this.boundingBox.x + this.boundingBox.width - centerX);
              scaleY = (centerY - rotatedY) / (centerY - this.boundingBox.y);
              break;
          case 2: // bottom-left
              scaleX = (centerX - rotatedX) / (centerX - this.boundingBox.x);
              scaleY = (rotatedY - centerY) / (this.boundingBox.y + this.boundingBox.height - centerY);
              break;
          case 3: // bottom-right
              scaleX = (rotatedX - centerX) / (this.boundingBox.x + this.boundingBox.width - centerX);
              scaleY = (rotatedY - centerY) / (this.boundingBox.y + this.boundingBox.height - centerY);
              break;
          case 4: // top-center
              scaleY = (centerY - rotatedY) / (centerY - this.boundingBox.y);
              break;
          case 5: // bottom-center
              scaleY = (rotatedY - centerY) / (this.boundingBox.y + this.boundingBox.height - centerY);
              break;
          case 6: // left-center
              scaleX = (centerX - rotatedX) / (centerX - this.boundingBox.x);
              break;
          case 7: // right-center
              scaleX = (rotatedX - centerX) / (this.boundingBox.x + this.boundingBox.width - centerX);
              break;
      }
      
      // Apply scaling to all points
      this.points = this.points.map(point => {
          const relX = point[0] - centerX;
          const relY = point[1] - centerY;
          return [
              centerX + relX * scaleX,
              centerY + relY * scaleY
          ];
      });
      
      this.draw();
  }

  
}


// Event handlers
function handleMouseDown(e) {
  if (isPaintToolActive) {
      isDrawingStroke = true;
      const { x, y } = getSvgCoordinates(e);
      points = [[x, y, e.pressure]];

      currentStroke = new FreehandStroke(points, {
          stroke: strokeColor,
          strokeWidth: strokeThickness
      });

      shapes.push(currentStroke);
      selectionManager.setShapes(shapes);
  } else if (isSelectionToolActive) {
      selectionManager.handleMouseDown(e);
  }
}

function handleMouseMove(e) {
  if (isDrawingStroke && isPaintToolActive) {
      const { x, y } = getSvgCoordinates(e);
      points.push([x, y, e.pressure]);
      currentStroke.points = points;
      currentStroke.draw();
  } else if (isSelectionToolActive) {
      selectionManager.handleMouseMove(e);
  }
}

function handleMouseUp(e) {
  isDrawingStroke = false;
  selectionManager.handleMouseUp(e);
}

// Color and thickness selection
strokeColors.forEach(span => {
  span.addEventListener("click", (event) => {
      strokeColors.forEach(el => el.classList.remove("selected"));
      span.classList.add("selected");
      strokeColor = span.getAttribute("data-id");
      
      if (selectionManager.selectedShapes.length > 0) {
          selectionManager.selectedShapes.forEach(shape => {
              shape.options.stroke = strokeColor;
              shape.draw();
          });
      }
  });
});

strokeThicknesses.forEach(span => {
  span.addEventListener("click", (event) => {
      strokeThicknesses.forEach(el => el.classList.remove("selected"));
      span.classList.add("selected");
      strokeThickness = parseInt(span.getAttribute("data-id"));
      
      if (selectionManager.selectedShapes.length > 0) {
          selectionManager.selectedShapes.forEach(shape => {
              shape.options.strokeWidth = strokeThickness;
              shape.draw();
          });
      }
  });
});

// Event listeners
svg.addEventListener('mousedown', handleMouseDown);
svg.addEventListener('mousemove', handleMouseMove);
svg.addEventListener('mouseup', handleMouseUp);