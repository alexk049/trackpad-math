import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import type { Category, SymbolItem } from '../types';

export function useCategories() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // 1. Fetch category names first
        apiClient<string[]>('/api/symbols/categories')
            .then(names => {
                // Initialize with names and empty items
                const initialCategories = names.map(name => ({ name, items: [] }));
                setCategories(initialCategories);

                // Once we have names, we can stop the initial "hard" loading 
                // and let the UI render the titles.
                setLoading(false);

                // 2. Fetch items for each category incrementally
                // We'll do this in parallel, but we could also do it sequentially if desired.
                names.forEach(name => {
                    apiClient<SymbolItem[]>(`/api/symbols/categories/${encodeURIComponent(name)}/items`)
                        .then(items => {
                            setCategories(prev => prev.map(cat =>
                                cat.name === name ? { ...cat, items } : cat
                            ));
                        })
                        .catch(err => {
                            console.error(`Failed to fetch items for category ${name}:`, err);
                        });
                });
            })
            .catch(err => {
                console.error("Failed to fetch categories:", err);
                setError(err.message);
                setLoading(false);
            });
    }, []);

    return { categories, loading, error };
}
