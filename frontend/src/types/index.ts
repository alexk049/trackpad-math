export interface Point {
    x: number;
    y: number;
    t: number;
}

export type ClassificationStatus = 'idle' | 'classifying' | 'finished' | 'error';

export interface ClassificationCandidate {
    symbol: string;
    confidence: number;
}

export interface ClassificationState {
    status: ClassificationStatus;
    symbol?: string;
    confidence?: number;
    candidates?: ClassificationCandidate[];
    message?: string;
}

export interface Settings {
    auto_mode: boolean;
    pause_threshold: number;
    equation_scroll_x_sensitivity: number;
    equation_scroll_y_sensitivity: number;
    // Desktop specific settings might be separate, but keeping here for now as they are often fetched together or similar context
    minimizeToTray?: boolean;
}

export interface SymbolDefinition {
    label: string;
    latex: string;
    description?: string;
}

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    detail?: string;
}

export interface TeacherPayload {
    label: string;
    points: Point[];
}

export interface SymbolItem {
    symbol: string;
    description: string;
    latex: string;
}

export interface Category {
    name: string;
    items: SymbolItem[];
}
