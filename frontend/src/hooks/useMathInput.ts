import { useRef, useCallback } from 'react';
import type { SymbolDefinition } from '../types';
import type { MathfieldElement, Selector } from 'mathlive';

/**
 * Hook to manage the logic and imperative actions of a Mathfield.
 * This hook should handle "WHAT" is done to the math (logic, templates, commands).
 * It provides a ref that should be passed to the MathInput component.
 */
export function useMathInput(symbols: SymbolDefinition[]) {
    const mfRef = useRef<MathfieldElement>(null);

    /**
     * Executes a mathlive command on the mathfield.
     * Supports both string selectors and array-style commands.
     */
    const executeCommand = useCallback((command: Selector, ...args: any[]) => {
        if (!mfRef.current) return;

        mfRef.current.executeCommand(command, ...args);
    }, []) as {
        (command: Selector, ...args: any[]): void;
    };

    /**
     * Inserts a symbol by its label, applying appropriate LaTeX templates.
     */
    const insertSymbol = useCallback((symbolLabel: string) => {
        const symbolDef = symbols.find(s => s.label === symbolLabel);
        if (!symbolDef) {
            console.warn(`Unknown symbol: ${symbolLabel}`);
            return false;
        }

        const symbolLatex = symbolDef.latex;
        const singleArgSymbols = ["\\sqrt", "\\sin", "\\cos", "\\tan", "\\log", "\\ln"];
        const doubleArgSymbols = ["\\frac"];
        const tripleArgSymbols = ["\\int", "\\sum"]

        let insertLatex = "";
        // #? = value placeholder
        // #@ = selection placeholder
        if (singleArgSymbols.includes(symbolLatex)) {
            insertLatex = `${symbolLatex}{#?}`;
        } else if (doubleArgSymbols.includes(symbolLatex)) {
            insertLatex = `${symbolLatex}{#?}{#?}`;
        } else if (tripleArgSymbols.includes(symbolLatex)) {
            insertLatex = `${symbolLatex}_{#?}^{#?} #@`;
        } else if (symbolLatex === "^") {
            insertLatex = '^{#?}';
        } else if (symbolLatex === "_") {
            insertLatex = '_{#?}';
        } else if (symbolLatex === "/") {
            insertLatex = '\\frac{#?}{#?}';
        } else {
            insertLatex = symbolLatex;
        }

        executeCommand('insert', insertLatex);
        return true;
    }, [symbols, executeCommand]);

    /**
     * Replaces the current selection or character with a new symbol.
     * Often used when clicking a suggestion.
     */
    const replaceWithSymbol = useCallback((symbolLabel: string) => {
        executeCommand('deleteBackward');
        return insertSymbol(symbolLabel);
    }, [executeCommand, insertSymbol]);

    /**
     * Focuses the mathfield.
     */
    const focus = useCallback(() => {
        mfRef.current?.focus();
    }, []);

    /**
     * Sets the value of the mathfield directly.
     */
    const setValue = useCallback((value: string) => {
        mfRef.current?.setValue(value, { silenceNotifications: true });
    }, []);

    return {
        mfRef,
        insertSymbol,
        replaceWithSymbol,
        executeCommand,
        focus,
        setValue
    };
}
