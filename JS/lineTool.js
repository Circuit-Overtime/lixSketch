let isDrawingLine = false; // State variable to track if the line drawing is in progress
let lineStartX = 0;       // Starting X coordinate of the line
let lineStartY = 0;       // Starting Y coordinate of the line
let currentLine = null;    // Reference to the current line element being drawn
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
    // Remove existing line if any
    if (currentLine) {
        svg.removeChild(currentLine);
        currentLine = null;
    }

    const rc = rough.svg(svg);

    // Draw the line with more custom roughness & bowing
    currentLine = rc.line(x1, y1, x2, y2, {
        stroke: lineColor,
        strokeWidth: lineStrokeWidth,
        roughness: lineSktetchRate,  // Custom roughness (0 = straight, higher = sketchy)
        bowing: lineEdgeType,        // Custom bowing (higher = more curved edges)
        strokeLineDash: lineStrokeStyle === 'dashed' ? [5, 5] : lineStrokeStyle === 'dotted' ? [2, 12] : []
    });

    currentLine.setAttribute('data-x1', x1);
    currentLine.setAttribute('data-y1', y1);
    currentLine.setAttribute('data-x2', x2);
    currentLine.setAttribute('data-y2', y2);
    currentLine.setAttribute('data-lineColor', lineColor);
    currentLine.setAttribute('data-lineStrokeWidth', lineStrokeWidth);
    currentLine.setAttribute('data-lineStrokeStyle', lineStrokeStyle);
    currentLine.setAttribute('data-lineEdgeType', lineEdgeType);
    currentLine.setAttribute('data-lineSktetchRate', lineSktetchRate);

    svg.appendChild(currentLine); // Append line to SVG
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
});

// Pointer move event listener
svg.addEventListener("pointermove", (e) => {
    if (!isDrawingLine) return;

    // Apply transformation matrix to mouse coordinates
    const CTM = svg.getScreenCTM();
    const x = (e.clientX - CTM.e) / CTM.a;   // Current X coordinate
    const y = (e.clientY - CTM.f) / CTM.d;   // Current Y coordinate

    // Draw line from the start point to current pointer position
    drawLine(lineStartX, lineStartY, x, y);
});

// Pointer up event listener
svg.addEventListener("pointerup", () => {
    if (!isDrawingLine) return;
    isDrawingLine = false;

    const CTM = svg.getScreenCTM();
    const x = (event.clientX - CTM.e) / CTM.a;   // Current X coordinate
    const y = (event.clientY - CTM.f) / CTM.d;   // Current Y coordinate
    drawLine(lineStartX, lineStartY, x, y);

    if (currentLine) {
        const x1 = parseFloat(currentLine.getAttribute('data-x1'));
        const y1 = parseFloat(currentLine.getAttribute('data-y1'));
        const x2 = parseFloat(currentLine.getAttribute('data-x2'));
        const y2 = parseFloat(currentLine.getAttribute('data-y2'));
        const lineColorValue = currentLine.getAttribute('data-lineColor');
        const lineStrokeWidthValue = parseFloat(currentLine.getAttribute('data-lineStrokeWidth'));
        const lineStrokeStyleValue = currentLine.getAttribute('data-lineStrokeStyle');
        const lineEdgeTypeValue = parseFloat(currentLine.getAttribute('data-lineEdgeType'));
        const lineSktetchRateValue = parseFloat(currentLine.getAttribute('data-lineSktetchRate'));

        const action = {
            type: ACTION_CREATE,
            element: currentLine,
            parent: currentLine.parentNode,
            nextSibling: currentLine.nextSibling,
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
        currentLine = null;
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
    drawLine(lineStartX, lineStartY, x, y);
    currentLine = null;
});


lineColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
        event.stopPropagation();
        const previousColor = lineColor;
        lineColorOptions.forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        lineColor = span.getAttribute("data-id");

         if (currentLine) {
            const action = {
                type: ACTION_MODIFY,
                element: currentLine,
                data: { property: 'lineColor', newValue: lineColor, oldValue: previousColor }
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

         if (currentLine) {
            const action = {
                type: ACTION_MODIFY,
                element: currentLine,
                data: { property: 'lineStrokeWidth', newValue: lineStrokeWidth, oldValue: previousThickness }
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

         if (currentLine) {
            const action = {
                type: ACTION_MODIFY,
                element: currentLine,
                data: { property: 'lineStrokeStyle', newValue: lineStrokeStyle, oldValue: previousStyle }
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

         if (currentLine) {
            const action = {
                type: ACTION_MODIFY,
                element: currentLine,
                data: { property: 'lineSktetchRate', newValue: lineSktetchRate, oldValue: previousSlope }
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

         if (currentLine) {
            const action = {
                type: ACTION_MODIFY,
                element: currentLine,
                data: { property: 'lineEdgeType', newValue: lineEdgeType, oldValue: previousEdge }
            };
            history.push(action);
            redoStack = [];
            updateUndoRedoButtons();
        }
    })
});