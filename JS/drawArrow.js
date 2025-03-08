let shapeEndpoints = []; // Store the endpoints of shapes for snapping
let highlightCircle = null; // Highlight indicator for snapping

let arrowStartX, arrowStartY;
let arrowElementGroup = null;


let arrowStrokeColor = "#fff";
let arrowStrokeThickness = 2;
let arrowOutlineStyle = "solid"; 
let arrowCurved = false;         
let arrowCurveAmount = 20;       
let arrowHeadLength = 10;        
let arrowHeadAngleDeg = 30;      
let arrowPoints = [];   
let arrowHeadStyle = "default";


let arrowStrokeColorOptions = document.querySelectorAll(".arrowStrokeSpan");
let arrowStrokeThicknessValue = document.querySelectorAll(".arrowStrokeThickSpan");
let arrowOutlineStyleValue = document.querySelectorAll(".arrowOutlineStyle");
let arrowTypeStyleValue = document.querySelectorAll(".arrowTypeStyle");
let arrowHeadStyleValue = document.querySelectorAll(".arrowHeadStyleSpan");

function drawArrow(x1, y1, x2, y2) {
  // Remove old arrow element if it exists.
  if (arrowElementGroup) {
      svg.removeChild(arrowElementGroup);
      arrowElementGroup = null;
  }

  // Snap endpoints if available.
  const startSnap = getSnapPoint ? getSnapPoint(x1, y1) : { x: x1, y: y1 };
  const endSnap = getSnapPoint ? getSnapPoint(x2, y2) : { x: x2, y: y2 };
  x1 = startSnap.x;
  y1 = startSnap.y;
  x2 = endSnap.x;
  y2 = endSnap.y;

  // Convert endpoints from screen to viewBox coordinates.
  const [vx1, vy1] = screenToViewBoxPoint(x1, y1);
  const [vx2, vy2] = screenToViewBoxPoint(x2, y2);

  const rc = rough.svg(svg);

  // ---  Create the ARROW HEAD  ---
  // Calculate the angle for the arrow head.
  const angle = Math.atan2(vy2 - vy1, vx2 - vx1);
  const arrowHead = createArrowHead(vx2, vy2, angle);

  // --- Create the ARROW TAIL ---
  // Draw the main line for the arrow in viewBox coordinates.
  const line = rc.line(vx1, vy1, vx2, vy2, {
      stroke: arrowStrokeColor,
      strokeWidth: arrowStrokeThickness,
  });

  if (arrowOutlineStyle === "dashed") {
      line.setAttribute("stroke-dasharray", "10,10");
  } else if (arrowOutlineStyle === "dotted") {
      line.setAttribute("stroke-dasharray", "2,8");
  }

  // --- Group the line and arrow head together ---
  arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  arrowElementGroup.appendChild(line);      // Append the tail (line)
  arrowElementGroup.appendChild(arrowHead); // Append the head

  svg.appendChild(arrowElementGroup);
}

function createArrowHead(tipX, tipY, angle) {
    const rc = rough.svg(svg);
    const arrowHeadAngle = arrowHeadAngleDeg * Math.PI / 180;
    let points;
    
    if (arrowHeadStyle === "default") {
      // Default V-shaped arrowhead.
      points = [
        [tipX, tipY],
        [tipX - arrowHeadLength * Math.cos(angle - arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle - arrowHeadAngle)],
        [tipX - arrowHeadLength * Math.cos(angle + arrowHeadAngle), tipY - arrowHeadLength * Math.sin(angle + arrowHeadAngle)]
      ];
    } 
    
    else if (arrowHeadStyle === "square") {
      // Create a square arrow head (proper square end) that is filled.
      // We'll treat arrowHeadLength as the side-length of the square.
      const L = arrowHeadLength;
      // v: unit vector along the arrow's direction.
      const v = { x: Math.cos(angle), y: Math.sin(angle) };
      // w: unit vector perpendicular to the arrow's direction.
      const w = { x: -Math.sin(angle), y: Math.cos(angle) };
    
      // Define the square so that its left side is flush with the arrow tip.
      // The arrow tip (tipX, tipY) will be the midpoint of the left side.
      // Left side endpoints:
      const A = [ tipX + (L/2) * w.x, tipY + (L/2) * w.y ]; // top-left
      const B = [ tipX - (L/2) * w.x, tipY - (L/2) * w.y ]; // bottom-left
      // Right side endpoints:
      const D = [ tipX + L * v.x + (L/2) * w.x, tipY + L * v.y + (L/2) * w.y ]; // top-right
      const C = [ tipX + L * v.x - (L/2) * w.x, tipY + L * v.y - (L/2) * w.y ]; // bottom-right
      
      // Build the points array in order.
      const points = [ A, B, C, D ];
    
      // Create a filled polygon using Rough.js with a solid fill.
      const rc = rough.svg(svg);
      const arrowHeadElement = rc.polygon(points, {
          fill: arrowStrokeColor,
          stroke: arrowStrokeColor,
          fillStyle: 'solid', // Ensures a solid fill.
          strokeWidth: arrowStrokeThickness,
      });
      
      // Optionally, apply dash styles if needed.
      if (arrowOutlineStyle === "dashed") {
        arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
      } else if (arrowOutlineStyle === "dotted") {
        arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
      }
      
      return arrowHeadElement;
    }
    
    
    
    else if (arrowHeadStyle === "solid") {
      // Create a circular filled arrow head.
      // Here, we treat arrowHeadLength as the radius of the circle.
      const rc = rough.svg(svg);
      // rough.js circle takes the diameter as the size parameter.
      const diameter = arrowHeadLength * 1;
      const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
        fill: arrowStrokeColor,
        stroke: arrowStrokeColor,
        fillStyle: 'solid',
        strokeWidth: 0.8,

      });
      
      return arrowHeadElement;
    }

    
    
    else if (arrowHeadStyle === "outline") {
      // Create a circular filled arrow head.
      // Here, we treat arrowHeadLength as the radius of the circle.
      const rc = rough.svg(svg);
      // rough.js circle takes the diameter as the size parameter.
      const diameter = arrowHeadLength * 1.2;
      const arrowHeadElement = rc.circle(tipX, tipY, diameter, {
        fill: arrowStrokeColor,
        stroke: arrowStrokeColor,
        fillStyle: 'none',
        strokeWidth: 0.2,

      });
      
      return arrowHeadElement;
    }
    
    const arrowHeadElement = rc.polygon(points, {
      fill: arrowStrokeColor,
      stroke: arrowStrokeColor,
      strokeWidth: arrowStrokeThickness,
    });
    
    if (arrowOutlineStyle === "dashed") {
      arrowHeadElement.setAttribute("stroke-dasharray", "10,10");
    } else if (arrowOutlineStyle === "dotted") {
      arrowHeadElement.setAttribute("stroke-dasharray", "2,8");
    }
    
    return arrowHeadElement;
  }



  function getSnapPoint(x, y) {
    const snapThreshold = 10; // If within 10px, snap to endpoint
    for (let pt of shapeEndpoints) {
      const dx = pt.x - x;
      const dy = pt.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= snapThreshold) {
        return { x: pt.x, y: pt.y };
      }
    }
    return { x, y };
  }

svg.addEventListener('pointerdown', handlePointerDownArrow);
svg.addEventListener('pointerup', handlePointerUpArrow);

function handlePointerDownArrow(e) {
    if (isArrowToolActive && !arrowCurved) {
        if (arrowElementGroup) {
          svg.removeChild(arrowElementGroup);
          arrowElementGroup = null;
        }
        arrowStartX = e.clientX;
      arrowStartY = e.clientY;
    }
    svg.addEventListener("pointermove", handlePointerMoveArrow);
}

function handlePointerMoveArrow(e) {
    if (isArrowToolActive && !arrowCurved) {
        drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);
    }
}

function handlePointerUpArrow(e) {
    svg.removeEventListener("pointermove", handlePointerMoveArrow);
    if (isArrowToolActive && !arrowCurved) {
        drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);
        if (arrowElementGroup) {
          history.push(arrowElementGroup);
          arrowElementGroup = null;
        }
    }
}

arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeColor = span.getAttribute("data-id");
        console.log("Selected Stroke Color:", arrowStrokeColor);
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeThickness = parseInt(span.getAttribute("data-id"));
        console.log("Selected Stroke Thickness:", arrowStrokeThickness);
        event.stopPropagation()
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowOutlineStyle = span.getAttribute("data-id");
        console.log("Selected Outline Style:", arrowOutlineStyle);
        event.stopPropagation()
    });
  });

  arrowTypeStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowTypeStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowCurved = span.getAttribute("data-id");
        console.log("Selected Arrow Style:", arrowCurved);
        event.stopPropagation()
    });
  });

  arrowHeadStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadStyle = span.getAttribute("data-id");
        console.log("Selected Arrow Head Style:", arrowHeadStyle);
        event.stopPropagation()
    });
  });