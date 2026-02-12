import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import 'mathlive';
import type { MathfieldElement } from 'mathlive';

interface MathInputProps {
    /** Current LaTeX value */
    value?: string;
    /** Called when the mathfield content changes */
    onChange?: (value: string) => void;
    /** Custom styles for the container */
    style?: React.CSSProperties;
    /** The DOM element where the virtual keyboard should be rendered. If not provided, it will use its default placement. */
    container?: HTMLElement;
    /** Whether the virtual keyboard should be visible */
    mvkVisible?: boolean;
}

/**
 * MathInput is a React wrapper around the <math-field> custom element.
 * It handles the view-level integration, styling, and basic event synchronization.
 */
export const MathInput = forwardRef<MathfieldElement, MathInputProps>(({
    value,
    onChange,
    style,
    container,
    mvkVisible
}, ref) => {
    const internalMfRef = useRef<MathfieldElement>(null);

    // Expose the internal element to the parent ref
    useImperativeHandle(ref, () => internalMfRef.current!);

    // Handle initial setup and event listeners
    useEffect(() => {
        const mf = internalMfRef.current;
        if (!mf) return;

        // Force manual policy so we can control it via the 'mvkVisible' prop
        mf.mathVirtualKeyboardPolicy = "manual";

        const handler = (evt: Event) => {
            const target = evt.target as MathfieldElement;
            onChange?.(target.value);
        };

        mf.addEventListener('input', handler);
        return () => mf.removeEventListener('input', handler);
    }, [onChange]);

    // Synchronize value prop with mathfield
    useEffect(() => {
        const mf = internalMfRef.current;
        if (!mf && value === undefined) return;

        // We only update if the value is different to avoid cursor jumps
        if (mf && mf.value !== value) {
            mf.setValue(value || "", { silenceNotifications: true });
        }
    }, [value]);

    // Handle Virtual Keyboard Container
    useEffect(() => {
        if (container) {
            window.mathVirtualKeyboard.container = container;
        }
    }, [container]);

    // Handle Virtual Keyboard Visibility
    useEffect(() => {
        if (mvkVisible) {
            window.mathVirtualKeyboard.show();
        } else {
            window.mathVirtualKeyboard.hide();
        }
    }, [mvkVisible]);

    return React.createElement('math-field', {
        ref: internalMfRef,
        style: {
            display: 'block',
            width: '100%',
            fontSize: '1.75em',
            minHeight: '2.5em',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--mantine-color-default-border)',
            ...style
        },
    });
});
