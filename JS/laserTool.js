let isDrawing = false;
let lasers = [];
const maxTrailLength = 20;
const fadeOutDuration = 1200;
const baseLaserOpacity = 0.8;
const baseLaserWidth = 3;
const minDistanceThreshold = 0.5;

let animationFrameId = null;
let lastMovePoint = null;
let hasMoved = false;

function screenToViewBoxPoint(x, y) {
    const CTM = svg.getScreenCTM();
    if (!CTM) return null;
    try {
        const inverseCTM = CTM.inverse();
        return {
            x: (x - CTM.e) * inverseCTM.a + (y - CTM.f) * inverseCTM.c,
            y: (x - CTM.e) * inverseCTM.b + (y - CTM.f) * inverseCTM.d
        };
    } catch (e) {
        console.error("Error inverting CTM:", e);
        return {
            x: (x - CTM.e) / CTM.a,
            y: (y - CTM.f) / CTM.d
        };
    }
}

function drawSegmentedPath(pathElement, id, points, opacity, strokeWidth) {
    if (!points || points.length < 2) {
        if (pathElement) pathElement.remove();
        return null;
    }
    let pathData = `M ${points[0].x} ${points[0].y}`;
    if (points.length < 3) {
        pathData += ` L ${points[1].x} ${points[1].y}`;
    } else {
        let cpStartX = points[0].x + (points[1].x - points[0].x) / 3;
        let cpStartY = points[0].y + (points[1].y - points[0].y) / 3;
        pathData += ` Q ${cpStartX} ${cpStartY}, ${points[1].x} ${points[1].y}`;
        for (let i = 1; i < points.length - 2; i++) {
            let p0 = points[i - 1];
            let p1 = points[i];
            let p2 = points[i + 1];
            let p3 = points[i + 2];
            let cp1x = p1.x + (p2.x - p0.x) / 6;
            let cp1y = p1.y + (p2.y - p0.y) / 6;
            let cp2x = p2.x - (p3.x - p1.x) / 6;
            let cp2y = p2.y - (p3.y - p1.y) / 6;
            pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
        let last = points.length - 1;
        let pLast = points[last];
        let pSecondLast = points[last - 1];
        let cpEndX = pLast.x - (pLast.x - pSecondLast.x) / 3;
        let cpEndY = pLast.y - (pLast.y - pSecondLast.y) / 3;
        pathData += ` Q ${cpEndX} ${cpEndY}, ${pLast.x} ${pLast.y}`;
    }
    if (!pathElement) {
        pathElement = document.createElementNS("http://www.w3.org/2000/svg", "path");
        pathElement.setAttribute("id", id);
        if (svg.firstChild) { svg.insertBefore(pathElement, svg.firstChild); }
        else { svg.appendChild(pathElement); }
    }
    pathElement.setAttribute("d", pathData);
    pathElement.setAttribute("stroke", `hsla(120, 100%, 50%, ${Math.max(0, Math.min(1, opacity))})`);
    pathElement.setAttribute("stroke-width", Math.max(0.1, strokeWidth));
    pathElement.setAttribute("fill", "none");
    pathElement.setAttribute("stroke-linecap", "round");
    pathElement.setAttribute("stroke-linejoin", "round");
    return pathElement;
}

function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function drawingLoop() {
    if (!isDrawing) {
        animationFrameId = null;
        return;
    }

    if (hasMoved && lastMovePoint) {
        const currentLaser = lasers[lasers.length - 1];
        if (currentLaser) {
            let svgPoint = screenToViewBoxPoint(lastMovePoint.x, lastMovePoint.y);

            if (svgPoint) {
                const lastLaserPoint = currentLaser.points[currentLaser.points.length - 1];
                if (!lastLaserPoint || distance(svgPoint, lastLaserPoint) >= minDistanceThreshold) {
                    currentLaser.points.push(svgPoint);

                    while (currentLaser.points.length > maxTrailLength) {
                        currentLaser.points.shift();
                    }

                    let laserPath = document.getElementById(currentLaser.id);
                    drawSegmentedPath(laserPath, currentLaser.id, currentLaser.points, baseLaserOpacity, baseLaserWidth);
                }
            }
        }
        hasMoved = false;
    }

    animationFrameId = requestAnimationFrame(drawingLoop);
}

function fadeLaserTrail(laser) {
    const startTime = performance.now();
    const initialPoints = [...laser.points];
    const totalPoints = initialPoints.length;
    let laserPath = document.getElementById(laser.id);

    if (totalPoints < 2 || !laserPath) {
        if (laserPath) laserPath.remove();
        lasers = lasers.filter(l => l.id !== laser.id);
        return;
    }

    function fade(currentTime) {
        const elapsedTime = currentTime - startTime;
        let progress = Math.min(1, elapsedTime / fadeOutDuration);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const pointsToKeep = Math.max(2, Math.round(totalPoints * (1 - progress)));

        const currentPoints = initialPoints.slice(-pointsToKeep);
        const currentOpacity = baseLaserOpacity * (1 - easedProgress);
        const currentWidth = Math.max(0.1, baseLaserWidth * (1 - easedProgress));

        laserPath = drawSegmentedPath(laserPath, laser.id, currentPoints, currentOpacity, currentWidth);

        if (progress < 1) {
            requestAnimationFrame(fade);
        } else {
            if (laserPath) laserPath.remove();
            lasers = lasers.filter(l => l.id !== laser.id);
        }
    }
    requestAnimationFrame(fade);
}

svg.addEventListener("pointerdown", (e) => {
    if (!selectedTool || !selectedTool.classList.contains("bxs-magic-wand") || isDrawing) return;
    if (e.target !== svg) {
        const isUIElement = e.target.closest('.selection-box, .resize-handle');
        if (isUIElement) return;
    }

    let screenPoint = { x: e.clientX, y: e.clientY };
    let startSvgPoint = screenToViewBoxPoint(screenPoint.x, screenPoint.y);
    if (!startSvgPoint) return;

    isDrawing = true;
    hasMoved = false;
    lastMovePoint = screenPoint;

    const laserId = "laserPath_" + Date.now() + "_" + Math.random().toString(16).slice(2);
    const newLaser = {
        id: laserId,
        points: [startSvgPoint],
        pathElement: null
    };
    lasers.push(newLaser);

    let initialPath = drawSegmentedPath(null, newLaser.id, newLaser.points, baseLaserOpacity, baseLaserWidth);

    svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;

    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(drawingLoop);
    }
});

svg.addEventListener("pointermove", (e) => {
    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
        svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    }

    if (!isDrawing) return;

    lastMovePoint = { x: e.clientX, y: e.clientY };
    hasMoved = true;
});

svg.addEventListener("pointerup", (e) => {
    if (!isDrawing) return;

    isDrawing = false;
    hasMoved = false;
    lastMovePoint = null;

    if (lasers.length > 0) {
        const laserToFade = lasers[lasers.length - 1];
        fadeLaserTrail(laserToFade);
    }

    if (selectedTool && selectedTool.classList.contains("bxs-magic-wand")) {
       svg.style.cursor = `url(${lazerCursor}) 10 10, auto`;
    } else {
       svg.style.cursor = 'default';
    }
});

svg.addEventListener("pointerleave", (e) => {
    if (!isDrawing) return;

    isDrawing = false;
    hasMoved = false;
    lastMovePoint = null;

    if (lasers.length > 0) {
        const laserToFade = lasers[lasers.length - 1];
        fadeLaserTrail(laserToFade);
    }
    svg.style.cursor = 'default';
});