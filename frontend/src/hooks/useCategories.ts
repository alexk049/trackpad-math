import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Category } from '../types';

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient<Category[]>('/api/symbols/categorized')
            .then(data => {
                setCategories(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch categorized symbols:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { categories, loading, error };
}
