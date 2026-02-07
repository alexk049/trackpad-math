import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import 'mathlive';

interface MathInputProps {
    value?: string;
    onChange?: (value: string) => void;
    style?: React.CSSProperties;
    container?: HTMLElement;
    mvkVisible?: boolean;
}

export const MathInput = forwardRef<HTMLElement, MathInputProps>(({ value, onChange, style, container, mvkVisible }, ref) => {
    const mfRef = useRef<HTMLElement>(null);

    useImperativeHandle(ref, () => mfRef.current!);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;

        // Attach listener
        const handler = (evt: Event) => {
            onChange?.((evt.target as any).value);
        };
        mf.addEventListener('input', handler);

        return () => mf.removeEventListener('input', handler);
    }, [onChange]);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;
        (mf as any).setValue(value, { suppressChangeNotifications: true });
    }, [value]);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;

        (mf as any).mathVirtualKeyboardPolicy = "manual";
        if (container) {
            window.mathVirtualKeyboard.container = container;
            window.mathVirtualKeyboard.show();
        }
    }, [container]);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;
        if (mvkVisible) {
            window.mathVirtualKeyboard.show();
        } else {
            window.mathVirtualKeyboard.hide();
        }
    }, [mvkVisible]);

    return React.createElement('math-field', {
        ref: mfRef,
        style: { display: 'block', width: '100%', fontSize: '2em', padding: '10px', borderRadius: '8px', ...style },
    });
});
