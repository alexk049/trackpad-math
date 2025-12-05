import pickle
import numpy as np
from typing import List, Tuple, Any, Dict
from sklearn.neighbors import KNeighborsClassifier
from sklearn.ensemble import RandomForestClassifier
import os

from trackpad_chars.processing import extract_features

class SymbolClassifier:
    def __init__(self, model_path: str = "model.pkl"):
        self.model = KNeighborsClassifier(n_neighbors=3)
        # self.model = RandomForestClassifier(n_estimators=100)
        self.model_path = model_path
        self.is_trained = False

    def train(self, drawings: List[Any], labels: List[str]):
        """
        drawings: List of Drawing objects or dicts equivalent.
        """
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
        self.is_trained = True
        self.save()

    def predict(self, strokes: List[List[Dict[str, float]]]) -> Tuple[str, float]:
        if not self.is_trained:
            # Try loading
            if not self.load():
                return ("Uninitialized", 0.0)
        
        features = extract_features(strokes).reshape(1, -1)
        pred = self.model.predict(features)[0]
        probs = self.model.predict_proba(features)
        confidence = np.max(probs)
        
        return (pred, confidence)

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
