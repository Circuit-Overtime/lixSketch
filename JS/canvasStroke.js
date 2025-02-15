// --- Utility Functions ---
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

function createNewPathElement() {
    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    newPath.setAttribute("stroke", strokeColor);
    newPath.setAttribute("fill", "none"); //Important: fill none so it doesnt fill the drawn stroke
    newPath.setAttribute("stroke-width", strokeThickness);
    newPath.setAttribute("stroke-linecap", "round");
    newPath.setAttribute("stroke-linejoin", "round");
    return newPath;
}

function renderStroke() {
    if (!currentPath) return;
    const stroke = getStroke(points, {
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
    currentPath.setAttribute('d', getSvgPathFromStroke(stroke));
}
