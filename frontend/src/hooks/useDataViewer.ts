import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { LabelData, Drawing } from '../types';

export function useDataViewer() {
    const [labels, setLabels] = useState<LabelData[]>([]);
    const [drawings, setDrawings] = useState<Drawing[]>([]);
    const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLabels = useCallback(async () => {
        try {
            const data = await apiClient<LabelData[]>('/api/labels');
            setLabels(data);
        } catch (err: any) {
            console.error("Failed to fetch labels", err);
            setError(err.message || "Failed to fetch labels");
        }
    }, []);

    const fetchDrawings = useCallback(async (label: string) => {
        setLoading(true);
        try {
            // Filter on backend to reduce data transfer
            const labelDrawings = await apiClient<Drawing[]>(`/api/drawings?label=${encodeURIComponent(label)}&limit=100`);
            setDrawings(labelDrawings);
            setLoading(false);
        } catch (err: any) {
            console.error("Failed to fetch drawings", err);
            setError(err.message || "Failed to fetch drawings");
            setLoading(false);
        }
    }, []);

    const selectLabel = useCallback((label: string) => {
        setSelectedLabel(label);
        setDrawings([]); // Clear while loading
        fetchDrawings(label);
    }, [fetchDrawings]);

    const deleteDrawings = useCallback(async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => apiClient(`/api/drawings/${id}`, { method: 'DELETE' })));

            // Refresh
            if (selectedLabel) {
                fetchDrawings(selectedLabel);
                fetchLabels(); // Update counts
            }
        } catch (err: any) {
            console.error("Failed to delete drawings", err);
            setError("Failed to delete drawings");
        }
    }, [selectedLabel, fetchDrawings, fetchLabels]);

    // Initial load
    useEffect(() => {
        fetchLabels();
    }, [fetchLabels]);

    return {
        labels,
        drawings,
        selectedLabel,
        loading,
        error,
        selectLabel,
        deleteDrawings,
        refreshLabels: fetchLabels
    };
}
