let isDrawingLine = false; // State variable to track if the line drawing is in progress
let lineStartX = 0;       // Starting X coordinate of the line
let lineStartY = 0;       // Starting Y coordinate of the line
let currentLineGroup = null;    // Reference to the current line element being drawn
let lineColor = "#fff";
let lineStrokeWidth = 3;
let lineStrokeStyle = "solid";
let lineEdgeType = 1;
let lineSktetchRate = 3;


let lineColorOptions = document.querySelectorAll(".lineColor > span");
let lineThicknessOptions = document.querySelectorAll(".lineThicknessSpan");
let lineOutlineOptions = document.querySelectorAll(".lineStyleSpan");
let lineSlopeOptions = document.querySelectorAll(".lineSlopeSpan");
let lineEdgeOptions = document.querySelectorAll(".lineEdgeSpan");

// --- Function to draw the line ---
function drawLine(x1, y1, x2, y2) {

    const rc = rough.svg(svg);
    const line = rc.line(x1, y1, x2, y2, {
        stroke: lineColor,
        strokeWidth: lineStrokeWidth,
        roughness: lineSktetchRate,  // Custom roughness (0 = straight, higher = sketchy)
        bowing: lineEdgeType,        // Custom bowing (higher = more curved edges)
        strokeLineDash: lineStrokeStyle === 'dashed' ? [5, 5] : lineStrokeStyle === 'dotted' ? [2, 12] : []
    });
    return line;
}

// --- Event Listeners ---

// Pointer down event listener
svg.addEventListener("pointerdown", (e) => {
    if (!isLineToolActive) return; // Check if line tool is selected

    isDrawingLine = true;

    // Apply transformation matrix to get coordinates relative to the SVG
    const CTM = svg.getScreenCTM();
    lineStartX = (e.clientX - CTM.e) / CTM.a; // Record initial X coordinate
    lineStartY = (e.clientY - CTM.f) / CTM.d; // Record initial Y coordinate

     // Create a line group element
     currentLineGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
     currentLineGroup.setAttribute("data-type", "line-group");
     svg.appendChild(currentLineGroup);
});

// Pointer move event listener
svg.addEventListener("pointermove", (e) => {
    if (!isDrawingLine) return;

    // Apply transformation matrix to mouse coordinates
    const CTM = svg.getScreenCTM();
    const x = (e.clientX - CTM.e) / CTM.a;   // Current X coordinate
    const y = (e.clientY - CTM.f) / CTM.d;   // Current Y coordinate


    // Clear the line group
    while (currentLineGroup.firstChild) {
        currentLineGroup.removeChild(currentLineGroup.firstChild);
    }

    // Draw line from the start point to current pointer position
    const line = drawLine(lineStartX, lineStartY, x, y);

    // Add attributes to the line group element
    currentLineGroup.setAttribute('data-x1', lineStartX);
    currentLineGroup.setAttribute('data-y1', lineStartY);
    currentLineGroup.setAttribute('data-x2', x);
    currentLineGroup.setAttribute('data-y2', y);
    currentLineGroup.setAttribute('data-lineColor', lineColor);
    currentLineGroup.setAttribute('data-lineStrokeWidth', lineStrokeWidth);
    currentLineGroup.setAttribute('data-lineStrokeStyle', lineStrokeStyle);
    currentLineGroup.setAttribute('data-lineEdgeType', lineEdgeType);
    currentLineGroup.setAttribute('data-lineSktetchRate', lineSktetchRate);

    currentLineGroup.appendChild(line);
});

// Pointer up event listener
svg.addEventListener("pointerup", () => {
    if (!isDrawingLine) return;
    isDrawingLine = false;

    const CTM = svg.getScreenCTM();
    const x = (event.clientX - CTM.e) / CTM.a;   // Current X coordinate
    const y = (event.clientY - CTM.f) / CTM.d;   // Current Y coordinate


   // Clear the line group
   while (currentLineGroup.firstChild) {
    currentLineGroup.removeChild(currentLineGroup.firstChild);
}

    // Draw line from the start point to current pointer position
    const line = drawLine(lineStartX, lineStartY, x, y);

    // Add attributes to the line group element
    currentLineGroup.setAttribute('data-x1', lineStartX);
    currentLineGroup.setAttribute('data-y1', lineStartY);
    currentLineGroup.setAttribute('data-x2', x);
    currentLineGroup.setAttribute('data-y2', y);
    currentLineGroup.setAttribute('data-lineColor', lineColor);
    currentLineGroup.setAttribute('data-lineStrokeWidth', lineStrokeWidth);
    currentLineGroup.setAttribute('data-lineStrokeStyle', lineStrokeStyle);
    currentLineGroup.setAttribute('data-lineEdgeType', lineEdgeType);
    currentLineGroup.setAttribute('data-lineSktetchRate', lineSktetchRate);

    currentLineGroup.appendChild(line);

    if (currentLineGroup) {
        const x1 = parseFloat(currentLineGroup.getAttribute('data-x1'));
        const y1 = parseFloat(currentLineGroup.getAttribute('data-y1'));
        const x2 = parseFloat(currentLineGroup.getAttribute('data-x2'));
        const y2 = parseFloat(currentLineGroup.getAttribute('data-y2'));
        const lineColorValue = currentLineGroup.getAttribute('data-lineColor');
        const lineStrokeWidthValue = parseFloat(currentLineGroup.getAttribute('data-lineStrokeWidth'));
        const lineStrokeStyleValue = currentLineGroup.getAttribute('data-lineStrokeStyle');
        const lineEdgeTypeValue = parseFloat(currentLineGroup.getAttribute('data-lineEdgeType'));
        const lineSktetchRateValue = parseFloat(currentLineGroup.getAttribute('data-lineSktetchRate'));

        const action = {
            type: ACTION_CREATE,
            element: currentLineGroup,
            parent: currentLineGroup.parentNode,
            nextSibling: currentLineGroup.nextSibling,
            data: {
                x1: x1,
                y1: y1,
                x2: x2,
                y2: y2,
                lineColor: lineColorValue,
                lineStrokeWidth: lineStrokeWidthValue,
                lineStrokeStyle: lineStrokeStyleValue,
                lineEdgeType: lineEdgeTypeValue,
                lineSktetchRate: lineSktetchRateValue
            }
        };
        history.push(action);
        updateUndoRedoButtons();
        currentLineGroup = null;
        redoStack = [];
    }
});

// Pointer leave event listener
svg.addEventListener("pointerleave", () => {
    if (!isDrawingLine) return;
    isDrawingLine = false;

    const CTM = svg.getScreenCTM();
    const x = (event.clientX - CTM.e) / CTM.a;   // Current X coordinate
    const y = (event.clientY - CTM.f) / CTM.d;   // Current Y coordinate


    // Clear the line group
    while (currentLineGroup.firstChild) {
        currentLineGroup.removeChild(currentLineGroup.firstChild);
    }

    // Draw line from the start point to current pointer position
    const line = drawLine(lineStartX, lineStartY, x, y);

    // Add attributes to the line group element
    currentLineGroup.setAttribute('data-x1', lineStartX);
    currentLineGroup.setAttribute('data-y1', lineStartY);
    currentLineGroup.setAttribute('data-x2', x);
    currentLineGroup.setAttribute('data-y2', y);
    currentLineGroup.setAttribute('data-lineColor', lineColor);
    currentLineGroup.setAttribute('data-lineStrokeWidth', lineStrokeWidth);
    currentLineGroup.setAttribute('data-lineStrokeStyle', lineStrokeStyle);
    currentLineGroup.setAttribute('data-lineEdgeType', lineEdgeType);
    currentLineGroup.setAttribute('data-lineSktetchRate', lineSktetchRate);

    currentLineGroup.appendChild(line);

    isDrawingLine = false;
    if (currentLineGroup && currentLineGroup.parentNode === svg) {
        svg.removeChild(currentLineGroup);
    }
    currentLineGroup = null;
});


lineColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousColor = lineColor;
        lineColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineColor = span.getAttribute("data-id");

        if (currentLineGroup) {
            const line = currentLineGroup.querySelector("line"); // Get the line

            if(line) line.setAttribute("stroke", lineColor); //Added Null Safe Check

            currentLineGroup.setAttribute('data-lineColor', lineColor); //Set for group, but it doesn't do anything
            const action = {
                type: ACTION_MODIFY,
                element: currentLineGroup,
                data: {
                    property: 'lineColor',
                    newValue: lineColor,
                    oldValue: previousColor
                }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
    });
});

lineThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousThickness = lineStrokeWidth;
        lineThicknessOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineStrokeWidth = parseInt(span.getAttribute("data-id"));

        if (currentLineGroup) {
            const line = currentLineGroup.querySelector("line"); // Get the line
             if(line) line.setAttribute("stroke-width", lineStrokeWidth); //Added Null Safe Check
            currentLineGroup.setAttribute('data-lineStrokeWidth', lineStrokeWidth);
            const action = {
                type: ACTION_MODIFY,
                element: currentLineGroup,
                data: {
                    property: 'lineStrokeWidth',
                    newValue: lineStrokeWidth,
                    oldValue: previousThickness
                }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
        event.stopPropagation();
    });
});

lineOutlineOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousStyle = lineStrokeStyle;
        lineOutlineOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineStrokeStyle = span.getAttribute("data-id");

        if (currentLineGroup) {
            const line = currentLineGroup.querySelector("line"); // Get the line
            let strokeLineDash = lineStrokeStyle === 'dashed' ? [5, 5] : lineStrokeStyle === 'dotted' ? [2, 12] : [];
            if(line) line.setAttribute("stroke-dasharray", strokeLineDash); //Added Null Safe Check

            currentLineGroup.setAttribute('data-lineStrokeStyle', lineStrokeStyle);
            const action = {
                type: ACTION_MODIFY,
                element: currentLineGroup,
                data: {
                    property: 'lineStrokeStyle',
                    newValue: lineStrokeStyle,
                    oldValue: previousStyle
                }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
    })
});

lineSlopeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousSlope = lineSktetchRate;
        lineSlopeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineSktetchRate = span.getAttribute("data-id");

        if (currentLineGroup) {
            const line = currentLineGroup.querySelector("line"); // Get the line

              // Re-draw the line with current values since sketchrate has to be applied while drawing
              if (line) {
                const x1 = parseFloat(currentLineGroup.getAttribute('data-x1'));
                const y1 = parseFloat(currentLineGroup.getAttribute('data-y1'));
                const x2 = parseFloat(currentLineGroup.getAttribute('data-x2'));
                const y2 = parseFloat(currentLineGroup.getAttribute('data-y2'));
                let newLine = drawLine(x1,y1,x2,y2);
                 
                  currentLineGroup.appendChild(newLine);
                  currentLineGroup.removeChild(line);
              }
            currentLineGroup.setAttribute('data-lineSktetchRate', lineSktetchRate);

            const action = {
                type: ACTION_MODIFY,
                element: currentLineGroup,
                data: {
                    property: 'lineSktetchRate',
                    newValue: lineSktetchRate,
                    oldValue: previousSlope
                }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
    })
});

lineEdgeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousEdge = lineEdgeType;
        lineEdgeOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineEdgeType = span.getAttribute("data-id");

        if (currentLineGroup) {
            const line = currentLineGroup.querySelector("line"); // Get the line
                 // Re-draw the line with current values since sketchrate has to be applied while drawing
              if (line) {
                const x1 = parseFloat(currentLineGroup.getAttribute('data-x1'));
                const y1 = parseFloat(currentLineGroup.getAttribute('data-y1'));
                const x2 = parseFloat(currentLineGroup.getAttribute('data-x2'));
                const y2 = parseFloat(currentLineGroup.getAttribute('data-y2'));
                let newLine = drawLine(x1,y1,x2,y2);
               
                  currentLineGroup.appendChild(newLine);
                  currentLineGroup.removeChild(line);
              }
            currentLineGroup.setAttribute('data-lineEdgeType', lineEdgeType);
            const action = {
                type: ACTION_MODIFY,
                element: currentLineGroup,
                data: {
                    property: 'lineEdgeType',
                    newValue: lineEdgeType,
                    oldValue: previousEdge
                }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
    })
});