import pickle
import numpy as np
from typing import List, Tuple, Any, Dict, Optional, Union
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
import os
from scipy.spatial.distance import euclidean
from fastdtw import fastdtw

from trackpad_chars.processing import extract_features, normalize, resample_drawing

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

    def train(self, drawings: List[Any], labels: List[str]):
        """
        drawings: List of Drawing objects or dicts equivalent.
        """
        if self.model_type == "dtw":
            self._train_dtw(drawings, labels)
        else:
            self._train_sklearn(drawings, labels)
            
        self.is_trained = True
        self.save()

    def _train_sklearn(self, drawings: List[Any], labels: List[str]):
        X = []
        y = []
        for d, label in zip(drawings, labels):
            # d.strokes is List[List[Dict]]
            features = extract_features(d.strokes)
            X.append(features)
            y.append(label)
        
        if not X:
            print("No data to train.")
            return

        X = np.array(X)
        self.model.fit(X, y)

    def _train_dtw(self, drawings: List[Any], labels: List[str]):
        # specific preprocessing for DTW: normalize + resample -> keep as sequence of points
        templates = []
        for d in drawings:
            # We want a clean sequence of points. 
            # flatten_drawing in processing.py gives (N, 3) with x,y,t
            # Better to normalize and resample first.
            
            # Use same norm/resample logic as extraction but keep structure
            norm_strokes = normalize(d.strokes)
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

    def predict(self, strokes: List[List[Dict[str, float]]]) -> List[Tuple[str, float]]:
        if not self.is_trained:
            # Try loading
            if not self.load():
                return [("Uninitialized", 0.0)]
        
        if self.model_type == "dtw":
            return self._predict_dtw(strokes)
        else:
            return self._predict_sklearn(strokes)

    def _predict_sklearn(self, strokes: List[List[Dict[str, float]]]) -> List[Tuple[str, float]]:
        features = extract_features(strokes).reshape(1, -1)
        probs = self.model.predict_proba(features)[0]
        classes = self.model.classes_
        
        results = []
        for i, label in enumerate(classes):
            results.append((label, probs[i]))
            
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def _predict_dtw(self, strokes: List[List[Dict[str, float]]]) -> List[Tuple[str, float]]:
        # Preprocess input same as training
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
