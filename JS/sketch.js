import { getStroke } from "https://cdn.skypack.dev/perfect-freehand";

let strokeColor = "#fff"; // Default stroke color is white
let strokeThickness = 2; // Default stroke thickness is 2

const tools = document.querySelectorAll(".toolbar i");
let selectedTool = document.querySelector(".bxs-paint"); // Default selected tool is brush
selectedTool.classList.add("selected");
const strokeColors = document.querySelectorAll(".strokeColors span");
const strokeThicknesses = document.querySelectorAll(".strokeThickness span");
let currentPath = null;
let points = [];
let history = [];
let redoStack = [];
const svg = document.querySelector('svg');

// Handle stroke color selection
strokeColors.forEach(stroke => {
    stroke.addEventListener("click", () => {
        strokeColors.forEach(s => s.classList.remove("selected"));
        stroke.classList.add("selected");
        strokeColor = stroke.getAttribute("data-id"); // Get new stroke color
        console.log("Selected Color:", strokeColor);
    });
});

// Handle stroke thickness selection
strokeThicknesses.forEach(thickness => {
    thickness.addEventListener("click", () => {
        strokeThicknesses.forEach(t => t.classList.remove("selected"));
        thickness.classList.add("selected");
        strokeThickness = parseInt(thickness.getAttribute("data-id")); // Get new stroke thickness
        console.log("Selected Thickness:", strokeThickness);
    });
});
// =============================================

// Handle tool selection
tools.forEach(tool => {
    tool.addEventListener("click", () => {
        tools.forEach(t => t.classList.remove("selected"));
        tool.classList.add("selected");
        selectedTool = tool;
        console.log(selectedTool);
        toolExtraPopup();
    });
});

//get tool extras 

function toolExtraPopup() 
{
    if(selectedTool.classList.contains("bxs-paint"))
    {
        document.getElementById("paintBrushSideBar").classList.remove("hidden");
    }
}
// Convert stroke points to an SVG path
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


//creating stroke nodes
function createNewPathElement() {
    const newPath = document.createElementNS("http://www.w3.org/2000/svg", "path");

    newPath.setAttribute("stroke", strokeColor);  
    newPath.setAttribute("fill", strokeColor);    
    newPath.setAttribute("stroke-width", strokeThickness);
    newPath.setAttribute("stroke-linecap", "round");
    newPath.setAttribute("stroke-linejoin", "round");

    svg.appendChild(newPath);
    return newPath;
}
    

// Render the stroke
function render() {
if (!currentPath) return;
const stroke = getStroke(points, {
    size: strokeThickness, 
    thinning: 2,
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


//handle pointer events
function handlePointerDown(e) {
    if (selectedTool.classList.contains("bxs-paint"))
        {
            points = [[e.clientX, e.clientY, e.pressure]];
            currentPath = createNewPathElement(); // **Create new path with latest color & thickness**
            render();
            svg.addEventListener('pointermove', handlePointerMove);

        }; 
    
}

function handlePointerMove(e) {
    if (e.buttons !== 1 || !selectedTool.classList.contains("bxs-paint")) return; // Only draw if brush is selected
    points.push([e.clientX, e.clientY, e.pressure]);
    render();
}

function handlePointerUp() {
    svg.removeEventListener('pointermove', handlePointerMove);
    if (currentPath) 
    {
        history.push(currentPath);
        redoStack = [];
        updateUndoRedoButtons();
    }
    currentPath = null; 

}

function undo() 
{
    if (history.length > 0) {
        let lastStroke = history.pop();  
        redoStack.push(lastStroke);      
        svg.removeChild(lastStroke);     
        updateUndoRedoButtons();         
    }
}

function redo() {
    if (redoStack.length > 0) {
        let lastRedo = redoStack.pop(); 
        history.push(lastRedo);         
        svg.appendChild(lastRedo);      
        updateUndoRedoButtons();        
    }
}

function updateUndoRedoButtons() {
    console.log(history.length)
    document.getElementById("undo").classList.toggle("disabled", history.length === 0);
    document.getElementById("redo").classList.toggle("disabled", redoStack.length === 0);
}



//svg behaviour
svg.addEventListener('pointerdown', handlePointerDown);
svg.addEventListener('pointerup', handlePointerUp);

window.onload = () => {
    toolExtraPopup();
    updateUndoRedoButtons();
}


//stack call button clicks 
document.getElementById("undo").addEventListener("click", undo);
document.getElementById("redo").addEventListener("click", redo);
