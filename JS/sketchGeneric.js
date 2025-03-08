let selectedTool = document.querySelector(".bxs-pointer");
let history = [];
let redoStack = [];

const svg = document.querySelector('#freehand-canvas');
const tools = document.querySelectorAll(".toolbar i");
const roughCanvas = window.rough.svg(svg);  
const roughGenerator = roughCanvas.generator;


let currentZoom = 1;
const minScale = 0.4;
const maxScale = 30; 
const minZoom = 0.4;
const maxZoom = 30; 
let currentTranslation = { x: 0, y: 0 }; 
const freehandCanvas = document.getElementById("freehand-canvas");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");
const zoomPercentSpan = document.getElementById("zoomPercent");
let currentMatrix = new DOMMatrix();
let container  = document.querySelector(".container");
let isPanning = false;
let panStart = null;
let startCanvasX, startCanvasY;
let currentViewBox = {
  x: 0,
  y: 0,
  width: window.innerWidth,
  height: window.innerHeight
};


let ispaintToolActive = false;
let isTextToolActive = false;
let isCircleToolActive = false;
let isSquareToolActive = false;
let isLaserToolActive = false;
let isEraserToolActive  = false;
let isImageToolActive = false;
let isArrowToolActive = false;
let isLineToolActive = false;
let isSelectionToolActive = false;
let isPanningToolActive = false;



const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");

const paintBrushSideBar = document.getElementById("paintBrushSideBar");
const lineSideBar = document.getElementById("lineSideBar");
const squareSideBar = document.getElementById("squareSideBar");
const circleSideBar = document.getElementById("circleSideBar");
const arrowSideBar = document.getElementById("arrowSideBar");
const textSideBar = document.getElementById("textSideBar");

const ACTION_CREATE = "create";
const ACTION_DELETE = "delete";
const ACTION_MODIFY = "modify";  
const ACTION_PASTE = "paste";

document.addEventListener("click", function(event) {
  const menuIcon = document.getElementById("menuIcon");
  const menu = document.querySelector(".menu");

  if (event.target === menuIcon) {
    menu.classList.toggle("hidden");
  } else {
    menu.classList.add("hidden");
  }
});


function toolExtraPopup() {
    if (selectedTool.classList.contains("bxs-paint")) {

        disableAllTools();
        ispaintToolActive = true;
        svg.style.cursor = "crosshair"
        disableAllSideBars();
        paintBrushSideBar.classList.remove("hidden");
    }
    else if (selectedTool.classList.contains("bx-square")) {

        disableAllTools();
        svg.style.cursor = "crosshair"
        isSquareToolActive = true;
        disableAllSideBars();
        squareSideBar.classList.remove("hidden");
    }
    else if(selectedTool.classList.contains("bx-circle"))
    {

        disableAllTools();
        svg.style.cursor = "crosshair"
        isCircleToolActive = true;
        disableAllSideBars();
        circleSideBar.classList.remove("hidden"); 
    }
    else if(selectedTool.classList.contains("bx-right-arrow-alt"))
    {
        disableAllTools();
        isArrowToolActive = true;
        disableAllSideBars();
        arrowSideBar.classList.remove("hidden");
    }
    else if(selectedTool.classList.contains("bxs-pointer"))
    {
        disableAllTools();
        isSelectionToolActive = true;
        svg.style.cursor = "all-scroll";
        disableAllSideBars();
    }
    else if(selectedTool.classList.contains("bxs-hand"))
    {
        disableAllTools();
        isPanningToolActive = true;
        svg.style.cursor = "grab";
        disableAllSideBars();
    }
    else if(selectedTool.classList.contains("bx-text"))
    {
      disableAllTools();
      isTextToolActive = true;
      svg.style.cursor = "text";
      disableAllSideBars();
      textSideBar.classList.remove("hidden");

    }
    else if(selectedTool.classList.contains("bxs-magic-wand"))
    {
        disableAllTools();
        svg.style.cursor = "crosshair";
        isLaserToolActive = true;
        disableAllSideBars();
    }
    else if(selectedTool.classList.contains("bx-dots-horizontal-rounded"))
    {
        disableAllTools();
        svg.style.cursor = "crosshair";
        isLineToolActive = true;
        disableAllSideBars();
        lineSideBar.classList.remove("hidden");
    }
    else if(selectedTool.classList.contains("bxs-eraser"))
    {
        disableAllTools();
        isEraserToolActive  = true;
        disableAllSideBars();
    }
    else if(selectedTool.classList.contains("bx-image-alt"))
    {
        disableAllTools();
        disableAllSideBars();
        svg.style.cursor = "crosshair"
    }
    else {
        disableAllTools();
        disableAllSideBars();
        svg.style.cursor = "crosshair"
    }
    

}


function disableAllSideBars()
{
  paintBrushSideBar.classList.add("hidden");
  lineSideBar.classList.add("hidden");
  squareSideBar.classList.add("hidden");
  circleSideBar.classList.add("hidden");
  arrowSideBar.classList.add("hidden");
  textSideBar.classList.add("hidden");
}
function disableAllTools() 
{
  ispaintToolActive = false;
  isSquareToolActive = false;
  isCircleToolActive = false;
  isArrowToolActive = false;
  isTextToolActive = false;
  isLaserToolActive = false;
  isLineToolActive = false;
  isEraserToolActive  = false;
  isSelectionToolActive = false;
  isImageToolActive = false;
  isPanningToolActive = false;
}

document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === 'z') {
    event.preventDefault();
    undo();
  }
});

document.addEventListener("keydown", function(event) {
  if (event.ctrlKey && event.key === 'y') {
    event.preventDefault();
    redo();
  }
});

tools.forEach(tool => tool.addEventListener("click", handleToolSelection));
function handleToolSelection(event) {
  tools.forEach(t => t.classList.remove("selected"));
  const tool = event.target;
  tool.classList.add("selected");
  selectedTool = tool;
  toolExtraPopup();
}


undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);


window.onload = () => {
  toolExtraPopup();
  updateUndoRedoButtons();
  resizeCanvas();

};

 
