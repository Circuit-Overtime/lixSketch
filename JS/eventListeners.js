import { handleMouseDownRect, handleMouseMoveRect, handleMouseUpRect } from './drawSquare.js';
import { handleMouseDownArrow, handleMouseMoveArrow, handleMouseUpArrow } from './drawArrow.js';

// Main event handlers that delegate to appropriate tools
const handleMainMouseDown = (e) => {
    if (isSquareToolActive || (isSelectionToolActive && currentShape?.shapeName === 'rectangle')) {
        handleMouseDownRect(e);
    } else if (isArrowToolActive || (isSelectionToolActive && currentShape?.shapeName === 'arrow')) {
        handleMouseDownArrow(e);
    } else if (isSelectionToolActive) {
        // Try both tools for selection
        handleMouseDownRect(e);
        if (!currentShape) {
            handleMouseDownArrow(e);
        }
    }
};

const handleMainMouseMove = (e) => {
    if (isSquareToolActive || (isSelectionToolActive && currentShape?.shapeName === 'rectangle')) {
        handleMouseMoveRect(e);
    } else if (isArrowToolActive || (isSelectionToolActive && currentShape?.shapeName === 'arrow')) {
        handleMouseMoveArrow(e);
    } else if (isSelectionToolActive) {
        // Handle hover effects for both tools
        handleMouseMoveRect(e);
        handleMouseMoveArrow(e);
    }
};

const handleMainMouseUp = (e) => {
    if (isSquareToolActive || (isSelectionToolActive && currentShape?.shapeName === 'rectangle')) {
        handleMouseUpRect(e);
    } else if (isArrowToolActive || (isSelectionToolActive && currentShape?.shapeName === 'arrow')) {
        handleMouseUpArrow(e);
    } else if (isSelectionToolActive) {
        handleMouseUpRect(e);
        handleMouseUpArrow(e);
    }
};

// Add single set of event listeners
svg.addEventListener('mousedown', handleMainMouseDown);
svg.addEventListener('mousemove', handleMainMouseMove);
svg.addEventListener('mouseup', handleMainMouseUp);