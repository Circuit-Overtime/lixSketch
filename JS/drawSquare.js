
function drawSquare(x, y, width, height) {
    if (squareElement) {
        svg.removeChild(squareElement);
        squareElement = null;
    }

    const rc = rough.svg(svg);
    const element = rc.rectangle(x, y, width, height, {
        stroke: squareStrokecolor,
        strokeWidth: squareStrokeThicknes,
        fill: squareBackgroundColor, 
        fillStyle: squareFillStyleValue, 
        hachureAngle: 60, 
        hachureGap: 10
    });

    if (squareOutlineStyle === "dashed") {
        element.setAttribute("stroke-dasharray", "10,10");
    } else if (squareOutlineStyle === "dotted") {
        element.setAttribute("stroke-dasharray", "2,8");
    }

    squareElement = element;
    svg.appendChild(element);

}
