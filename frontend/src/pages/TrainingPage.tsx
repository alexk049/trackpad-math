import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Center, Loader, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../api/client';

import { useCategories } from '../hooks/useCategories';
import { useTrainingSession } from '../hooks/useTrainingSession';
import { useRecorder } from '../hooks/useRecorder';

import { TrainingSelection } from '../components/training/TrainingSelection';
import { TrainingSession } from '../components/training/TrainingSession';
import { TrainingCompletion } from '../components/training/TrainingCompletion';

export default function TrainingPage() {
    const [searchParams] = useSearchParams();

    // Hooks
    const { categories, loading: categoriesLoading, error: categoriesError } = useCategories();
    const session = useTrainingSession();
    const { isRecording, recordedPoints, toggleRecording } = useRecorder(true);

    // Initial URL param handling
    useEffect(() => {
        const symbol = searchParams.get('symbol');
        if (symbol) {
            session.initTraining([symbol]);
        }
    }, [searchParams]);

    // Sync recorder to session
    useEffect(() => {
        if (recordedPoints && recordedPoints.length > 0) {
            session.setLastRecording(recordedPoints);
        }
    }, [recordedPoints]);

    // Handlers
    const handleNextRecording = async () => {
        if (!session.state.lastRecording) return;

        try {
            await apiClient('/api/teach', {
                method: 'POST',
                body: JSON.stringify({
                    label: session.currentSymbol,
                    points: session.state.lastRecording
                })
            });

            // Advance
            session.advanceProgress();

            // Logic:
            // If we are NOT finishing the entire session, we want to start recording again.
            // If isLastSample is true, then 'advance' will move to 'completion'. So DO NOT record.
            // If isLastSample is false, we are either moving to next count or next symbol. So DO record.

            if (!session.isLastSample) {
                toggleRecording();
            }

        } catch (e: any) {
            console.error("Failed to save", e);
            notifications.show({ title: 'Error', message: 'Failed to save training data', color: 'red' });
        }
    };

    const handleRedraw = () => {
        session.setLastRecording(null);
        toggleRecording(); // Start recording again
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && session.state.step === 'training') {
                e.preventDefault();
                if (!isRecording && session.state.lastRecording) {
                    handleNextRecording();
                } else {
                    toggleRecording();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session.state.step, isRecording, session.state.lastRecording, toggleRecording]);


    // Render
    if (categoriesLoading) {
        return <Center h="50vh"><Loader /></Center>;
    }

    if (categoriesError) {
        return <Center h="50vh"><Text c="red">Error loading categories: {categoriesError}</Text></Center>;
    }

    if (session.state.step === 'selection') {
        return (
            <TrainingSelection
                categories={categories}
                selectedSymbols={session.state.selectedSymbols}
                onToggleSymbol={session.toggleSymbol}
                onToggleCategory={session.toggleCategory}
                onStart={session.startTraining}
            />
        );
    }

    if (session.state.step === 'training') {
        return (
            <TrainingSession
                symbol={session.currentSymbol}
                progressLabel={session.progressLabel}
                isRecorderRecording={isRecording}
                lastRecording={session.state.lastRecording}
                isLastSample={session.isLastSample}
                onStartRecording={toggleRecording}
                onRedraw={handleRedraw}
                onNext={handleNextRecording}
            />
        );
    }

    if (session.state.step === 'completion') {
        return (
            <TrainingCompletion
                count={session.state.trainingQueue.length}
                onTrainMore={session.restart}
            />
        );
    }

    return null;
}
