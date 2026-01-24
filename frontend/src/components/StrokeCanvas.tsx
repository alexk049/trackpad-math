import { useRef, useEffect } from 'react';
import { Center } from '@mantine/core';
import { segmentStrokes } from '../hooks/useRecorder';

interface Point {
    x: number;
    y: number;
    t: number;
}

interface StrokeCanvasProps {
    points: Point[];
    width?: number;
    height?: number;
    showArrows?: boolean;
}

export function StrokeCanvas({ points, width = 300, height = 300, showArrows = true }: StrokeCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current || !points) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);

        if (points.length === 0) return;

        // Theme aware background (transparent allows CSS to handle it)
        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#228be6'; // Blue
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const strokes = segmentStrokes(points);

        const drawingWidth = maxX - minX || 1;
        const drawingHeight = maxY - minY || 1;
        const padding = 0.8;
        const scale = Math.min((width * padding) / drawingWidth, (height * padding) / drawingHeight);
        const offsetX = (width - drawingWidth * scale) / 2;
        const offsetY = (height - drawingHeight * scale) / 2;

        const drawArrowhead = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size: number = 8) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-size, -size * 0.6);
            ctx.lineTo(-size, size * 0.6);
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
            ctx.restore();
        };

        strokes.forEach(stroke => {
            if (stroke.length === 0) return;

            // Draw the line (or a dot if only one point)
            if (stroke.length === 1) {
                const x = (stroke[0].x - minX) * scale + offsetX;
                const y = (stroke[0].y - minY) * scale + offsetY;
                ctx.beginPath();
                ctx.arc(x, y, ctx.lineWidth * 1.2, 0, Math.PI * 2);
                ctx.fillStyle = '#fab005'; // Orange for dots
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(
                    (stroke[0].x - minX) * scale + offsetX,
                    (stroke[0].y - minY) * scale + offsetY
                );
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo(
                        (stroke[i].x - minX) * scale + offsetX,
                        (stroke[i].y - minY) * scale + offsetY
                    );
                }
                ctx.stroke();

                if (showArrows) {
                    // Draw arrowheads along the path
                    let distanceSinceLastArrow = 15; // Start with a small offset
                    const arrowSpacing = 40; // Pixels between arrows

                    for (let i = 1; i < stroke.length; i++) {
                        const x1 = (stroke[i - 1].x - minX) * scale + offsetX;
                        const y1 = (stroke[i - 1].y - minY) * scale + offsetY;
                        const x2 = (stroke[i].x - minX) * scale + offsetX;
                        const y2 = (stroke[i].y - minY) * scale + offsetY;

                        const dx = x2 - x1;
                        const dy = y2 - y1;
                        const segmentLen = Math.sqrt(dx * dx + dy * dy);

                        if (segmentLen === 0) continue;

                        distanceSinceLastArrow += segmentLen;

                        if (distanceSinceLastArrow >= arrowSpacing) {
                            const angle = Math.atan2(dy, dx);
                            drawArrowhead(ctx, x2, y2, angle);
                            distanceSinceLastArrow = 0;
                        }
                    }

                    // Always ensure an arrow at the end of the stroke if it's long enough
                    const last = stroke[stroke.length - 1];
                    const prev = stroke[stroke.length - 2];
                    const x1 = (prev.x - minX) * scale + offsetX;
                    const y1 = (prev.y - minY) * scale + offsetY;
                    const x2 = (last.x - minX) * scale + offsetX;
                    const y2 = (last.y - minY) * scale + offsetY;
                    const angle = Math.atan2(y2 - y1, x2 - x1);
                    drawArrowhead(ctx, x2, y2, angle);
                }
            }
        });
    }, [points, width, height, showArrows]);

    return (
        <Center style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 8, padding: 20 }}>
            <canvas ref={canvasRef} width={width} height={height} />
        </Center>
    );
}
