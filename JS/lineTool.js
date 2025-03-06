const defaultStrokeColor = "#fff";  // Default stroke color
const defaultStrokeWidth = 3;      // Default stroke width
const lineStroke = "solid";


// --- Function to draw the line ---
function drawLine(x1, y1, x2, y2) {
  // Check if there's an existing line and remove it
  if (currentLine) {
    svg.removeChild(currentLine);
    currentLine = null;
  }

  const rc = rough.svg(svg);

  // Draw the line using Rough.js
  currentLine = rc.line(x1, y1, x2, y2, {
    stroke: defaultStrokeColor,
    strokeWidth: defaultStrokeWidth,
    fill: "hachure",        // Default fill style
    fillStyle: "hachure",  // Ensure fillStyle is also set for consistency
    hachureAngle: 60,       // Default hachure angle
    // Default hachure gap
    strokeLineDash: lineStroke === 'dashed' ? [5, 5] : lineStroke === 'dotted' ? [2, 12] : []

  });

  svg.appendChild(currentLine); // Append line to SVG
}

// --- Event Listeners ---

// Pointer down event listener
svg.addEventListener("pointerdown", (e) => {
  if (!isLineToolSelected) return; // Check if line tool is selected

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
  isDrawingLine = false;
  currentLine = null; // Reset to null for the NEXT line to be drawn
});

// Pointer leave event listener
svg.addEventListener("pointerleave", () => {
  isDrawingLine = false;
  currentLine = null; // Reset on pointer leave to clear the line
});