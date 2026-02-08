import type { MathfieldElement } from "mathlive";

/**
 * Maps an insertion point index to its real string index in a valid LaTeX string.
 * 
 * An "insertion point" is a position in the LaTeX string where a number or letter can be 
 * inserted while maintaining the structural validity of the LaTeX. Positions inside 
 * a command name (e.g., between the '\' and 's' in '\sqrt') are NOT considered 
 * insertion points because inserting a character there would break the command token.
 * 
 * @param latex - A valid LaTeX string.
 * @param insertionPointIndex - The index of the insertion point (0-indexed).
 * @returns The real index in the string corresponding to that insertion point.
 * @throws Error if the insertionPointIndex is negative or greater than the total number of points.
 */
export function getRealIndexForInsertionPoint(latex: string, insertionPointIndex: number): number {
    let i = 0;
    const insertionPoints: number[] = [];
    while (i < latex.length) {
        if (latex[i] === '\\') {
            // A command token starts with a backslash.
            if (i + 1 < latex.length) {
                const nextChar = latex[i + 1];
                if (/[a-zA-Z]/.test(nextChar)) {
                    // Multi-letter command (e.g., \alpha, \sqrt).
                    // Consumes all alphabetical characters.
                    i++; // move past \
                    while (i < latex.length && /[a-zA-Z]/.test(latex[i])) {
                        i++;
                    }
                } else {
                    // Single-character command escape (e.g., \+, \{, \ ).
                    // Consumes exactly two characters (backslash and the character).
                    i += 2;
                }
            } else {
                // Trailing backslash - technically invalid/incomplete but we consume it.
                i++;
            }
        } else {
            // Any other character is considered a single-character token (boundary exists after it).
            i++;
        }

        // After identifying a token (either a command or a single char), 
        // the index after it is a valid insertion point.
        insertionPoints.push(i);
    }

    if (insertionPointIndex < 0 || insertionPointIndex >= insertionPoints.length) {
        throw new Error(
            `Insertion point index ${insertionPointIndex} is out of range. ` +
            `Valid range: [0, ${insertionPoints.length - 1}].`
        );
    }

    return insertionPoints[insertionPointIndex];
}


function processVerticalNavigation(mf: MathfieldElement, direction: number): void {
    const EXCLUDE_LIST = ['+', '-', '*', '/', '=', '>', '<', '±', '÷'];
    const { value, position, selection } = mf;
    console.log("position: ", position);
    console.log("value: ", value);
    console.log("style: ", mf.lastOffset)
    for (let i = 0; i < mf.lastOffset; i++) {
        console.log(mf.getValue(i, i + 1));
    }

    // 1. Determine the character directly to the left
    const charToLeft = position > 0 ? value[position - 1] : null;

    // 2. Determine if we are inside a sub/superscript
    // Logic: Walk backwards to find the nearest unclosed '{' and see if it's preceded by '_' or '^'
    let isSubscript = false;
    let isSuperscript = false;
    let isEmpty = false;

    let braceDepth = 0;
    for (let i = position - 1; i >= 0; i--) {
        if (value[i] === '}') braceDepth++;
        if (value[i] === '{') {
            if (braceDepth === 0) {
                // We found the opening brace of the current group
                const prefix = value[i - 1];
                if (prefix === '_') isSubscript = true;
                if (prefix === '^') isSuperscript = true;

                // Check if empty: if next char is the closing brace
                if (value[i + 1] === '}') isEmpty = true;
                break;
            } else {
                braceDepth--;
            }
        }
    }

    const isInScript = isSubscript || isSuperscript;
    console.log("char to left: ", charToLeft);
    console.log("is in script: ", isInScript);
    console.log("is empty: ", isEmpty);

    // --- Decision Logic ---

    // Condition 3: Empty sub/superscript handling
    if (isInScript && isEmpty) {
        console.log("executing condition 3");
        mf.executeCommand("deleteBackward");
        mf.executeCommand(direction > 0 ? "moveDown" : "moveUp");
        return;
    }

    // Condition 1: Left value is in exclude list
    if (charToLeft && EXCLUDE_LIST.includes(charToLeft)) {
        console.log("executing condition 1");
        mf.executeCommand(direction > 0 ? "moveDown" : "moveUp");
        return;
    }

    // Condition 2: Left value is NOT in exclude list
    if (charToLeft && !EXCLUDE_LIST.includes(charToLeft)) {
        console.log("executing condition 2");
        mf.executeCommand(direction > 0 ? "moveToSubscript" : "moveToSuperscript");
        return;
    }
    console.log("fail")
}