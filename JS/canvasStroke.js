// --- Utility Functions ---

// Converts a point (x, y) from screen/canvas coordinates to viewBox coordinates.
function screenToViewBoxPoint(x, y) {
    return [
      currentViewBox.x + x / currentZoom,
      currentViewBox.y + y / currentZoom
    ];
  }
  
  // Generates an SVG path string from a stroke (an array of [x, y] points).
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
  
  // Creates a new path element with the desired style.
  function createNewPathElement() {
    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    newPath.setAttribute("stroke", strokeColor);
    newPath.setAttribute("fill", "none"); // Important: fill none so it doesn't fill the drawn stroke
    newPath.setAttribute("stroke-width", strokeThickness);
    newPath.setAttribute("stroke-linecap", "round");
    newPath.setAttribute("stroke-linejoin", "round");
    return newPath;
  }
  
  // Renders the current freehand stroke.
  // Note: 'points' is assumed to be an array of [x, y] pairs in screen/canvas coordinates.
  function renderStroke() {
    if (!currentPath) return;
    
    // Convert all recorded points to viewBox coordinates.
    const convertedPoints = points.map(([x, y]) => screenToViewBoxPoint(x, y));
    
    // Generate a stroke using the converted points.
    const stroke = getStroke(convertedPoints, {
      size: strokeThickness,
      thinning: 0.5,
      smoothing: 0.8,
      streamline: 0.2,
      easing: (t) => t,
      start: {
        taper: 0,
        easing: (t) => t,
        cap: true
      },
      end: {
        taper: 0,
        easing: (t) => t,
        cap: true
      },
      simulatePressure: false
    });
    
    // Set the 'd' attribute of the path using the generated stroke.
    currentPath.setAttribute('d', getSvgPathFromStroke(stroke));
  }
  