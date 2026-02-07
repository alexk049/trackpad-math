import { useRef, useCallback } from 'react';
import type { SymbolDefinition } from '../types';

export function useMathInput(symbols: SymbolDefinition[]) {
    const mfRef = useRef<any>(null);

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
            insertLatex = symbolLatex + '{#?}';
        } else if (doubleArgSymbols.includes(symbolLatex)) {
            insertLatex = symbolLatex + '{#?}{#?}';
        } else if (tripleArgSymbols.includes(symbolLatex)) {
            insertLatex = symbolLatex + '_{#?}^{#?} #@';
        } else if (symbolLatex === '[') {
            insertLatex = '[ #@ ]';
        } else if (symbolLatex === '(') {
            insertLatex = '( #@ )';
        } else if (symbolLatex === '{') {
            insertLatex = '{ #@ }';
        } else if (symbolLatex === "^") {
            insertLatex = '^{#?}';
        } else if (symbolLatex === "_") {
            insertLatex = '_{#?}';
        } else if (symbolLatex === "/") {
            insertLatex = '\\frac{#?}{#?}';
        } else {
            insertLatex = symbolLatex;
        }

        mfRef.current?.executeCommand(['insert', insertLatex]);
        return true;
    }, [symbols]);

    const executeCommand = useCallback((command: string | any[]) => {
        mfRef.current?.executeCommand(command);
    }, []);

    const focus = useCallback(() => {
        if (mfRef.current) {
            mfRef.current.focus();
        }
    }, []);

    return {
        mfRef,
        insertSymbol,
        executeCommand,
        focus
    };
}
