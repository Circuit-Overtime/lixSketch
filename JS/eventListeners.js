import { handleMouseDownRect, handleMouseMoveRect, handleMouseUpRect } from './drawSquare.js';
import { handleMouseDownArrow, handleMouseMoveArrow, handleMouseUpArrow } from './drawArrow.js';
import { handleMouseDownCircle, handleMouseMoveCircle, handleMouseUpCircle } from './drawCircle.js';
import { handleMouseUpImage, handleMouseDownImage, handleMouseMoveImage } from './imageTool.js';
import { handleMouseDownLine, handleMouseMoveLine, handleMouseUpLine } from './lineTool.js';
import { handleFreehandMouseDown, handleFreehandMouseMove, handleFreehandMouseUp } from './canvasStroke.js';
import { handleTextMouseDown, handleTextMouseMove, handleTextMouseUp } from './writeText.js';


const handleMainMouseDown = (e) => {
    if (isSquareToolActive) {
        handleMouseDownRect(e);
    } else if (isArrowToolActive) {
        handleMouseDownArrow(e);
    } else if (isCircleToolActive) {
        handleMouseDownCircle(e);
    } else if (isImageToolActive) {
        handleMouseDownImage(e);
    } 
    else if (isLineToolActive) {
        handleMouseDownLine(e);
    }
    else if (isPaintToolActive) {
        handleFreehandMouseDown(e);
    }
    else if (isTextToolActive) {
        handleTextMouseDown(e);
    }
    else if (isSelectionToolActive) {
        if (currentShape?.shapeName === 'rectangle') {
            handleMouseDownRect(e);
        } else if (currentShape?.shapeName === 'arrow') {
            handleMouseDownArrow(e);
        } else if (currentShape?.shapeName === 'circle') {
            handleMouseDownCircle(e);
        } else if (currentShape?.shapeName === 'image') {
            handleMouseDownImage(e);
        }
        else if (currentShape?.shapeName === 'line') {
            handleMouseDownLine(e);
        }
        else if (currentShape?.shapeName === 'freehandStroke') {
            handleFreehandMouseDown(e);
        }
        else if (currentShape?.shapeName === 'text') {
            handleTextMouseDown(e);
        }

        else {
            const originalCurrentShape = currentShape;
            handleMouseDownRect(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleMouseDownCircle(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleMouseDownArrow(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleMouseDownImage(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleMouseDownLine(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleFreehandMouseDown(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            handleTextMouseDown(e);
            if (currentShape && currentShape !== originalCurrentShape) return;
            if (currentShape === originalCurrentShape) {
                if (currentShape) {
                    currentShape.removeSelection();
                    currentShape = null;
                }
            }
        }
    }
};

const handleMainMouseMove = (e) => {
    if (isSquareToolActive) {
        handleMouseMoveRect(e);
    } else if (isArrowToolActive) {
        handleMouseMoveArrow(e);
    } else if (isCircleToolActive) {
        handleMouseMoveCircle(e);
    } else if (isImageToolActive) {
        handleMouseMoveImage(e);
    } 
    else if (isLineToolActive) {
        handleMouseMoveLine(e);
    }
    else if (isPaintToolActive) {
        handleFreehandMouseMove(e);
    }
    else if (isTextToolActive) {
        handleTextMouseMove(e);
    }

    else if (isSelectionToolActive) {
        if (currentShape?.shapeName === 'rectangle') {
            handleMouseMoveRect(e);
        } else if (currentShape?.shapeName === 'arrow') {
            handleMouseMoveArrow(e);
        } else if (currentShape?.shapeName === 'circle') {
            handleMouseMoveCircle(e);
        } else if (currentShape?.shapeName === 'image') {
            handleMouseMoveImage(e);
        } 
        else if (currentShape?.shapeName === 'line') {
            handleMouseMoveLine(e);
        }
        else if (currentShape?.shapeName === 'freehandStroke') {
            handleFreehandMouseMove(e);
        }
        else if (currentShape?.shapeName === 'text') {
            handleTextMouseMove(e);
        }
        else {
            handleMouseMoveRect(e);
            handleMouseMoveArrow(e);
            handleMouseMoveCircle(e);
            handleMouseMoveImage(e);
            handleMouseMoveLine(e);
            handleFreehandMouseMove(e);
            handleTextMouseMove(e);
        }
    }
};

const handleMainMouseUp = (e) => {
    if (isSquareToolActive) {
        handleMouseUpRect(e);
    } else if (isArrowToolActive) {
        handleMouseUpArrow(e);
    } else if (isCircleToolActive) {
        handleMouseUpCircle(e);
    } else if (isImageToolActive) {
        handleMouseUpImage(e);
    } 
    else if (isLineToolActive) {    
        handleMouseUpLine(e);
    }
    else if (isPaintToolActive) {
        handleFreehandMouseUp(e);
    }
    else if (isTextToolActive) {
        handleTextMouseUp(e);
    }
    else if (isSelectionToolActive) {
        if (currentShape?.shapeName === 'rectangle') {
            handleMouseUpRect(e);
        } else if (currentShape?.shapeName === 'arrow') {
            handleMouseUpArrow(e);
        } else if (currentShape?.shapeName === 'circle') {
            handleMouseUpCircle(e);
        } else if (currentShape?.shapeName === 'image') {
            handleMouseUpImage(e);
        } 
        else if (currentShape?.shapeName === 'line') {
            handleMouseUpLine(e);
        }
        else if (currentShape?.shapeName === 'freehandStroke') {
            handleFreehandMouseUp(e);
        }
        else if (currentShape?.shapeName === 'text') {
            handleTextMouseUp(e);
        }
        else {
            handleMouseUpRect(e);
            handleMouseUpArrow(e);
            handleMouseUpCircle(e);
            handleMouseUpImage(e);
            handleMouseUpLine(e);
            handleFreehandMouseUp(e);
            handleTextMouseUp(e);
        }
    }
};

svg.addEventListener('mousedown', handleMainMouseDown);
svg.addEventListener('mousemove', handleMainMouseMove);
svg.addEventListener('mouseup', handleMainMouseUp);