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


function screenToViewBoxPointArrow(x, y) {
  return [
    currentViewBox.x + x / currentZoom,
    currentViewBox.y + y / currentZoom
  ];
}

function drawArrow(x1, y1, x2, y2) {
    // Remove old arrow element if it exists.
    if (arrowElementGroup) {
        //Remove all children to clear it
        while (arrowElementGroup.firstChild) {
          arrowElementGroup.removeChild(arrowElementGroup.firstChild);
      }
    }
     // Snap endpoints if available.
     const startSnap = getSnapPoint ? getSnapPoint(x1, y1) : {x: x1, y: y1};
     const endSnap = getSnapPoint ? getSnapPoint(x2, y2) : {x: x2, y: y2};
     x1 = startSnap.x;
     y1 = startSnap.y;
     x2 = endSnap.x;
     y2 = endSnap.y;
 
     // Convert to viewBox coordinates.
     const [vx1, vy1] = screenToViewBoxPointArrow(x1, y1);
     const [vx2, vy2] = screenToViewBoxPointArrow(x2, y2);

    const angle = Math.atan2(vy2 - vy1, vx2 - vx1);

    // --- Create a SINGLE PATH for the arrow ---
    let pathData = `M ${vx1} ${vy1} L ${vx2} ${vy2}`; // Main line

    if (arrowHeadStyle === "default") {
        // V-shaped arrowhead
        const arrowHeadAngle = (arrowHeadAngleDeg * Math.PI) / 180;
        const x3 = vx2 - arrowHeadLength * Math.cos(angle - arrowHeadAngle);
        const y3 = vy2 - arrowHeadLength * Math.sin(angle - arrowHeadAngle);
        const x4 = vx2 - arrowHeadLength * Math.cos(angle + arrowHeadAngle);
        const y4 = vy2 - arrowHeadLength * Math.sin(angle + arrowHeadAngle);

        pathData += ` M ${vx2} ${vy2} L ${x3} ${y3} M ${vx2} ${vy2} L ${x4} ${y4}`;
    } else if (arrowHeadStyle === "solid") {
        // Circle head
        pathData += ` M ${vx2 - arrowHeadLength} ${vy2} A ${arrowHeadLength} ${arrowHeadLength} 0 1 1 ${vx2 + arrowHeadLength} ${vy2}`;
    } else if (arrowHeadStyle === "square") {
        // Square head
        const L = arrowHeadLength;
        const v = {x: Math.cos(angle), y: Math.sin(angle)};
        const w = {x: -Math.sin(angle), y: Math.cos(angle)};

        const A = [vx2 + (L / 2) * w.x, vy2 + (L / 2) * w.y];
        const B = [vx2 - (L / 2) * w.x, vy2 - (L / 2) * w.y];
        const C = [vx2 + L * v.x - (L / 2) * w.x, vy2 + L * v.y - (L / 2) * w.y];
        const D = [vx2 + L * v.x + (L / 2) * w.x, vy2 + L * v.y + (L / 2) * w.y];

        pathData += ` M ${A[0]} ${A[1]} L ${B[0]} ${B[1]} L ${C[0]} ${C[1]} L ${D[0]} ${D[1]} Z`;
    }

    // Create the single path element
    const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    arrowPath.setAttribute("d", pathData);
    arrowPath.setAttribute("stroke", arrowStrokeColor);
    arrowPath.setAttribute("stroke-width", arrowStrokeThickness);
    arrowPath.setAttribute("fill", "none");
    if (arrowOutlineStyle === "dashed") {
      arrowPath.setAttribute("stroke-dasharray", "10,10");
    } else if (arrowOutlineStyle === "dotted") {
      arrowPath.setAttribute("stroke-dasharray", "2,8");
    }
     //Store properties
    arrowPath.setAttribute("data-x1", vx1);
    arrowPath.setAttribute("data-y1", vy1);
    arrowPath.setAttribute("data-x2", vx2);
    arrowPath.setAttribute("data-y2", vy2);
    arrowPath.setAttribute("data-arrowStrokeColor", arrowStrokeColor);
    arrowPath.setAttribute("data-arrowStrokeThickness", arrowStrokeThickness);
    arrowPath.setAttribute("data-arrowOutlineStyle", arrowOutlineStyle);
    arrowPath.setAttribute("data-arrowHeadStyle", arrowHeadStyle);

    if(!arrowElementGroup){
        arrowElementGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        arrowElementGroup.setAttribute("data-type", "arrow-group");
    }
    //Clean
    while (arrowElementGroup.firstChild) {
        arrowElementGroup.removeChild(arrowElementGroup.firstChild);
    }
     arrowElementGroup.appendChild(arrowPath);

    
    return arrowElementGroup;
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
        //This is to handle the intitial draw in a single click
        if(arrowElementGroup && arrowElementGroup.parentNode) svg.removeChild(arrowElementGroup);
        arrowElementGroup = null;

        arrowStartX = e.clientX;
        arrowStartY = e.clientY;
    }
    svg.addEventListener("pointermove", handlePointerMoveArrow);
}

function handlePointerMoveArrow(e) {
    if (isArrowToolActive && !arrowCurved) {
      //This is to handle a single click
      if (arrowElementGroup && arrowElementGroup.parentNode) svg.removeChild(arrowElementGroup);
      arrowElementGroup = null;

        const arrow = drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);
        if(arrow)  {
                if(arrow.parentNode != svg)
                  svg.appendChild(arrow) //Add the arrow
        }
    }
}

function handlePointerUpArrow(e) {
    svg.removeEventListener("pointermove", handlePointerMoveArrow);
    if (isArrowToolActive && !arrowCurved) {
        const arrow = drawArrow(arrowStartX, arrowStartY, e.clientX, e.clientY);

        if (arrow) {
           svg.appendChild(arrow);
          if (arrowElementGroup) {
            const x1 = parseFloat(arrowElementGroup.querySelector("path").getAttribute("data-x1"));
            const y1 = parseFloat(arrowElementGroup.querySelector("path").getAttribute("data-y1"));
            const x2 = parseFloat(arrowElementGroup.querySelector("path").getAttribute("data-x2"));
            const y2 = parseFloat(arrowElementGroup.querySelector("path").getAttribute("data-y2"));
            const arrowStrokeColorValue = arrowElementGroup.querySelector("path").getAttribute("data-arrowStrokeColor");
            const arrowStrokeThicknessValue = parseFloat(arrowElementGroup.querySelector("path").getAttribute("data-arrowStrokeThickness"));
            const arrowOutlineStyleValue = arrowElementGroup.querySelector("path").getAttribute("data-arrowOutlineStyle");
            const arrowHeadStyleValue = arrowElementGroup.querySelector("path").getAttribute("data-arrowHeadStyle");

            const action = {
                type: ACTION_CREATE,
                element: arrowElementGroup,
                parent: arrowElementGroup.parentNode,
                nextSibling: arrowElementGroup.nextSibling,
                data: {
                    x1: x1,
                    y1: y1,
                    x2: x2,
                    y2: y2,
                    arrowStrokeColor: arrowStrokeColorValue,
                    arrowStrokeThickness: arrowStrokeThicknessValue,
                    arrowOutlineStyle: arrowOutlineStyleValue,
                    arrowHeadStyle: arrowHeadStyleValue
                }
            };
            //svg.appendChild(arrowElementGroup) //Add the arrow

            history.push(action);
            arrowElementGroup = null;
            redoStack = [];
            updateUndoRedoButtons();
          }
       }
    }
}

arrowStrokeColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation(); // Stop event propagation
        const previousStroke = arrowStrokeColor
        arrowStrokeColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeColor = span.getAttribute("data-id");

         if (arrowElementGroup) {
           const arrowPath = arrowElementGroup.querySelector("path")
            if(arrowPath) arrowPath.setAttribute("stroke", arrowStrokeColor);

            const action = {
                type: ACTION_MODIFY,
                element: arrowElementGroup,
                data: { property: 'stroke', newValue: arrowStrokeColor, oldValue: previousStroke }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Color:", arrowStrokeColor);
    });
});

arrowStrokeThicknessValue.forEach((span) => {
    span.addEventListener("click", (event) => {
      const previousArrowStrokeThickness = arrowStrokeThickness
        arrowStrokeThicknessValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowStrokeThickness = parseInt(span.getAttribute("data-id"));

        if (arrowElementGroup) {
           const arrowPath = arrowElementGroup.querySelector("path")
           if(arrowPath) arrowPath.setAttribute("stroke-width", arrowStrokeThickness);
            const action = {
                type: ACTION_MODIFY,
                element: arrowElementGroup,
                data: { property: 'strokeWidth', newValue: arrowStrokeThickness, oldValue: previousArrowStrokeThickness }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        console.log("Selected Stroke Thickness:", arrowStrokeThickness);
        event.stopPropagation()
    });
});

arrowOutlineStyleValue.forEach((span) => {
    span.addEventListener("click", (event) => {
      const previousArrowOutlineStyle = arrowOutlineStyle
        arrowOutlineStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowOutlineStyle = span.getAttribute("data-id");

         if (arrowElementGroup) {
              const arrowPath = arrowElementGroup.querySelector("path")
              let strokeLineDash = arrowOutlineStyle === "dashed" ? "10,10" : arrowOutlineStyle === "dotted" ? "2,8" : "";
              if(arrowPath) arrowPath.setAttribute("stroke-dasharray", strokeLineDash);
            const action = {
                type: ACTION_MODIFY,
                element: arrowElementGroup,
                data: { property: 'outlineStyle', newValue: arrowOutlineStyle, oldValue: previousArrowOutlineStyle }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
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
        const previousArrowHeadStyle = arrowHeadStyle
        arrowHeadStyleValue.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        arrowHeadStyle = span.getAttribute("data-id");

        //if (arrowElementGroup) {
            // const action = {
            //     type: ACTION_MODIFY,
            //     element: arrowElementGroup,
            //     data: { property: 'arrowHeadStyle', newValue: arrowHeadStyle, oldValue: previousArrowHeadStyle }
            // };
            // history.push(action);
            // redoStack = [];
            // updateUndoRedoButtons();
        //}

        console.log("Selected Arrow Head Style:", arrowHeadStyle);
        event.stopPropagation()
    });
  });