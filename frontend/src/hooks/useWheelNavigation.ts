import { useEffect, useRef } from 'react';
import type { Settings } from '../types';

export function useWheelNavigation(
    mfRef: React.RefObject<any>,
    settings: Settings | null
) {
    const wheelAccumulatorX = useRef(0);
    const wheelAccumulatorY = useRef(0);
    const lastWheelTime = useRef(0);
    const lastWheelAxis = useRef<'x' | 'y' | null>(null);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!mfRef.current || document.activeElement !== mfRef.current) {
                return;
            }

            //prevent default for page scroll
            e.preventDefault();

            const now = Date.now();
            if (now - lastWheelTime.current > 150) {
                wheelAccumulatorX.current = 0;
                wheelAccumulatorY.current = 0;
                lastWheelAxis.current = null;
            }
            lastWheelTime.current = now;

            let dx = e.deltaX;
            let dy = e.deltaY;

            if (e.shiftKey && dx === 0) {
                dx = dy;
                dy = 0;
            }

            const thresholdX = settings?.equation_scroll_x_sensitivity ? 400 / settings.equation_scroll_x_sensitivity : 20;
            const thresholdY = settings?.equation_scroll_y_sensitivity ? 400 / settings.equation_scroll_y_sensitivity : 20;

            if (Math.abs(dx) > Math.abs(dy)) {
                // X axis dominant
                if (lastWheelAxis.current !== 'x') {
                    wheelAccumulatorX.current = 0;
                    wheelAccumulatorY.current = 0;
                    lastWheelAxis.current = 'x';
                }
                wheelAccumulatorX.current += dx;
                const steps = Math.floor(Math.abs(wheelAccumulatorX.current) / thresholdX);
                if (steps > 0) {
                    const direction = Math.sign(wheelAccumulatorX.current);
                    for (let i = 0; i < steps; i++) {
                        mfRef.current.executeCommand(direction > 0 ? 'moveToNextChar' : 'moveToPreviousChar');
                    }
                    wheelAccumulatorX.current -= steps * thresholdX * direction;
                }
            } else if (Math.abs(dy) > Math.abs(dx)) {
                // Y axis dominant
                if (lastWheelAxis.current !== 'y') {
                    wheelAccumulatorX.current = 0;
                    wheelAccumulatorY.current = 0;
                    lastWheelAxis.current = 'y';
                }
                wheelAccumulatorY.current += dy;
                const steps = Math.floor(Math.abs(wheelAccumulatorY.current) / thresholdY);
                if (steps > 0) {
                    const direction = Math.sign(wheelAccumulatorY.current);
                    for (let i = 0; i < steps; i++) {
                        mfRef.current.executeCommand(direction > 0 ? 'moveDown' : 'moveUp');
                    }
                    wheelAccumulatorY.current -= steps * thresholdY * direction;
                }
            }
        };

        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            window.removeEventListener('wheel', handleWheel);
        };
    }, [settings, mfRef]);
}
