import pickle
import numpy as np
from typing import List, Tuple, Any, Dict, Optional, Union
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
import os
from scipy.spatial.distance import euclidean
from fastdtw import fastdtw

from trackpad_chars.processing import extract_features, normalize, resample_drawing, segment_strokes

Strokes = List[List[Dict[str, float]]]
Points = List[Dict[str, float]]

class SymbolClassifier:
    def __init__(self, model_type: str = "knn", base_path: str = "model"):
        self.model_type = model_type.lower()
        self.base_path = base_path
        self.model_path = f"{base_path}_{self.model_type}.pkl"
        self.is_trained = False
        
        self.model: Any = None
        self._init_model()

    def _init_model(self):
        if self.model_type == "knn":
            self.model = KNeighborsClassifier(n_neighbors=3)
        elif self.model_type == "rf":
            self.model = RandomForestClassifier(n_estimators=100)
        elif self.model_type == "dtw":
            # DTW is lazy, "training" is just storing templates
            self.model = {"templates": [], "labels": []}
        else:
            raise ValueError(f"Unknown model type: {self.model_type}")

    def train(self, drawings: List[Points], labels: List[str]):
        """
        drawings: List of flat points for each example.
        """
        if self.model_type == "dtw":
            self._train_dtw(drawings, labels)
        else:
            self._train_sklearn(drawings, labels)
            
        self.is_trained = True
        self.save()

    def reset(self):
        """Reset the model to an untrained state."""
        self._init_model()
        self.is_trained = False
        if os.path.exists(self.model_path):
            os.remove(self.model_path)

    def _train_sklearn(self, drawings: List[Points], labels: List[str]):
        X = []
        y = []
        for d, label in zip(drawings, labels):
            # d is Points (List[Dict])
            strokes = segment_strokes(d)
            features = extract_features(strokes)
            X.append(features)
            y.append(label)
        
        if not X:
            print("No data to train.")
            return

        X = np.array(X)
        self.model.fit(X, y)

    def _train_dtw(self, drawings: List[Points], labels: List[str]):
        # specific preprocessing for DTW: normalize + resample -> keep as sequence of points
        templates = []
        for d in drawings:
            # d is Points (List[Dict])
            strokes = segment_strokes(d)
            norm_strokes = normalize(strokes)
            resampled = resample_drawing(norm_strokes, points_per_stroke=20)
            
            # Flatten to (N, 2) array for fastdtw
            points = []
            for stroke in resampled:
                for p in stroke:
                    points.append([p['x'], p['y']])
            
            if not points:
                points = [[0.0, 0.0]] # dummy
            
            templates.append(np.array(points))
            
        self.model = {
            "templates": templates,
            "labels": labels
        }

    def predict(self, points: Points) -> List[Tuple[str, float]]:
        if not self.is_trained:
            # Try loading
            if not self.load():
                return [("Uninitialized", 0.0)]
        
        if self.model_type == "dtw":
            return self._predict_dtw(points)
        else:
            return self._predict_sklearn(points)

    def _predict_sklearn(self, points: Points) -> List[Tuple[str, float]]:
        strokes = segment_strokes(points)
        features = extract_features(strokes).reshape(1, -1)
        probs = self.model.predict_proba(features)[0]
        classes = self.model.classes_
        
        results = []
        for i, label in enumerate(classes):
            results.append((label, probs[i]))
            
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def _predict_dtw(self, points: Points) -> List[Tuple[str, float]]:
        # Preprocess input same as training
        strokes = segment_strokes(points)
        norm_strokes = normalize(strokes)
        resampled = resample_drawing(norm_strokes, points_per_stroke=20)
        
        input_points = []
        for stroke in resampled:
            for p in stroke:
                input_points.append([p['x'], p['y']])
        input_arr = np.array(input_points)
        
        if len(input_arr) == 0:
             return [("Empty", 0.0)]

        # Compare against all templates
        templates = self.model["templates"]
        labels = self.model["labels"]
        
        distances = []
        
        for i, templ in enumerate(templates):
            dist, path = fastdtw(input_arr, templ, dist=euclidean)
            distances.append((labels[i], dist))
            
        # We need to aggregate dists by label (1-NN or k-NN)
        # 1-NN strategy: Find the single closest template
        distances.sort(key=lambda x: x[1])
        
        # Convert distance to a "confidence" score?
        # Distance 0 -> Conf 1. Large dist -> Conf 0.
        # This is arbitrary. For now, let's just return the sorted list of labels
        # and use 1.0 / (1.0 + dist) as pseudo-conf
        
        best_label, best_dist = distances[0]
        
        # Aggregate unique labels slightly for display
        # We'll just return the top K matches
        results = []
        seen_labels = set()
        for label, dist in distances:
            if label not in seen_labels:
                score = 1.0 / (1.0 + dist)
                results.append((label, score))
                seen_labels.add(label)
                if len(results) >= 5:
                    break
        
        return results

    def add_example(self, points: Points, label: str):
        """
        Increment incrementally update the model with a new example.
        Only supported for clean 'instance-based' models like KNN and DTW.
        """
        if self.model_type == "rf":
            print("Warning: Random Forest does not support incremental updates. Training required.")
            return

        strokes = segment_strokes(points)

        if self.model_type == "dtw":
            # Just append to templates
            norm_strokes = normalize(strokes)
            resampled = resample_drawing(norm_strokes, points_per_stroke=20)
            p_arr = []
            for stroke in resampled:
                for p in stroke:
                    p_arr.append([p['x'], p['y']])
            if not p_arr: 
                p_arr = [[0.0, 0.0]]
            
            self.model["templates"].append(np.array(p_arr))
            self.model["labels"].append(label)
            self.save()
            return
            
        if self.model_type == "knn":
            # For KNN, we need to add to the existing training set.
            # Sklearn's KNN stores data in _fit_X and encoded labels in _y.
            
            new_features = extract_features(strokes).reshape(1, -1)
            
            if hasattr(self.model, "_fit_X") and self.model._fit_X is not None and hasattr(self.model, "_y"):
                X = np.vstack([self.model._fit_X, new_features])
                
                # Decode existing labels
                # self.model._y are indices into self.model.classes_
                if hasattr(self.model, "classes_"):
                    decoded_y = self.model.classes_[self.model._y]
                    y = np.append(decoded_y, label)
                else:
                    # Fallback if classes_ missing (shouldn't happen for trained model)
                    y = np.append(self.model._y, label)
            else:
                # First example?
                X = new_features
                y = np.array([label])
            
            self.model.fit(X, y)
            self.is_trained = True
            self.save()

    def save(self):
        with open(self.model_path, 'wb') as f:
            pickle.dump(self.model, f)
            
    def load(self) -> bool:
        if os.path.exists(self.model_path):
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
            self.is_trained = True
            return True
        return False
