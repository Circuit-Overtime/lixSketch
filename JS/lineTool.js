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
  history.push(currentLine);
  updateUndoRedoButtons();
  currentLine = null; 
});

// Pointer leave event listener
svg.addEventListener("pointerleave", () => {
  if (!isDrawingLine) return;
  isDrawingLine = false;
  currentLine = null; 
});


lineColorOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      lineColorOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      lineColor = span.getAttribute("data-id");
    });
  });

  lineThicknessOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      lineThicknessOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      lineStrokeWidth = parseInt(span.getAttribute("data-id"));
      event.stopPropagation();
    });
  });

  lineOutlineOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      lineOutlineOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      lineStrokeStyle = span.getAttribute("data-id");
    })
  })

  lineSlopeOptions.forEach((span) => {
    span.addEventListener("click", (event) => {
      event.stopPropagation();
      lineSlopeOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      lineSktetchRate = span.getAttribute("data-id");
    })
  });

  lineEdgeOptions.forEach((span) => {
    span.addEventListener("click" , (event) => {
      event.stopPropagation();
      lineEdgeOptions.forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      lineEdgeType = span.getAttribute("data-id");
    })
  })