import random
import time
from trackpad_chars.db import init_db, get_db, Drawing
from trackpad_chars.model import SymbolClassifier
from trackpad_chars.processing import normalize

def create_dummy_drawing(label):
    # Create normalized-ish strokes
    # "A" like shape: / \ -
    # "B" like shape: | 3
    strokes = []
    if label == "A":
        # Stroke 1: /
        strokes.append([{"x": 0.0, "y": 1.0, "t": 0.0}, {"x": 0.5, "y": 0.0, "t": 0.1}])
        # Stroke 2: \
        strokes.append([{"x": 0.5, "y": 0.0, "t": 0.2}, {"x": 1.0, "y": 1.0, "t": 0.3}])
        # Stroke 3: -
        strokes.append([{"x": 0.2, "y": 0.5, "t": 0.4}, {"x": 0.8, "y": 0.5, "t": 0.5}])
    elif label == "B":
        # Stroke 1: |
        strokes.append([{"x": 0.0, "y": 0.0, "t": 0.0}, {"x": 0.0, "y": 1.0, "t": 0.1}])
        # Stroke 2: 3 roughly
        strokes.append([{"x": 0.0, "y": 0.0, "t": 0.2}, {"x": 0.5, "y": 0.2, "t": 0.3}, {"x": 0.0, "y": 0.5, "t": 0.4}])
        strokes.append([{"x": 0.0, "y": 0.5, "t": 0.5}, {"x": 0.5, "y": 0.8, "t": 0.6}, {"x": 0.0, "y": 1.0, "t": 0.7}])
    
    # Add some noise
    for stroke in strokes:
        for p in stroke:
            p['x'] += random.uniform(-0.05, 0.05)
            p['y'] += random.uniform(-0.05, 0.05)
    
    # Flatten strokes into points
    points = []
    for stroke in strokes:
        points.extend(stroke)
    return points

def verify():
    print("Initializing DB...")
    init_db()
    
    db = next(get_db())
    # Clear existing
    try:
        db.query(Drawing).delete()
        db.commit()
    except:
        db.rollback()

    print("Generating training data...")
    for _ in range(10):
        db.add(Drawing(label="A", points=create_dummy_drawing("A")))
        db.add(Drawing(label="B", points=create_dummy_drawing("B")))
    db.commit()
    
    print("Training model...")
    clf = SymbolClassifier()
    drawings = db.query(Drawing).all()
    clf.train([d.points for d in drawings], [d.label for d in drawings])
    
    print("Testing prediction...")
    test_a = create_dummy_drawing("A")
    res = clf.predict(test_a)
    pred, conf = res[0]
    print(f"Test A -> Predicted: {pred} (Conf: {conf})")
    
    test_b = create_dummy_drawing("B")
    res = clf.predict(test_b)
    pred, conf = res[0]
    print(f"Test B -> Predicted: {pred} (Conf: {conf})")

if __name__ == "__main__":
    verify()
