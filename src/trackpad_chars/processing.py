import numpy as np
from typing import List, Dict, Any

def normalize(strokes: List[List[Dict[str, float]]]) -> List[List[Dict[str, float]]]:
    """
    Centers the drawing at 0,0 and scales it to fit within a unit square [-0.5, 0.5],
    preserving aspect ratio.
    """
    if not strokes:
        return []

    # Collect all points
    all_points = []
    for stroke in strokes:
        for p in stroke:
            all_points.append([p['x'], p['y']])
    
    if not all_points:
        return strokes

    arr = np.array(all_points)
    min_vals = np.min(arr, axis=0)
    max_vals = np.max(arr, axis=0)
    
    # Calculate dimensions
    width = max_vals[0] - min_vals[0]
    height = max_vals[1] - min_vals[1]
    
    # Avoid division by zero
    scale = 1.0 / max(width, height, 1e-6)
    
    # Center translation
    center_x = (min_vals[0] + max_vals[0]) / 2.0
    center_y = (min_vals[1] + max_vals[1]) / 2.0
    
    new_strokes = []
    for stroke in strokes:
        new_stroke = []
        for p in stroke:
            new_stroke.append({
                "x": (p['x'] - center_x) * scale,
                "y": (p['y'] - center_y) * scale,
                "t": p['t'] # Keep time relative or original? Usually relative is enough, but we leave it.
            })
        new_strokes.append(new_stroke)
        
    return new_strokes

def flatten_drawing(strokes: List[List[Dict[str, float]]]) -> np.ndarray:
    """
    Flattens a drawing into a single numpy array of shape (N, 3) where columns are x, y, t.
    Useful for DTW. Stroke breaks are implicit in the large jumps in x/y or just concatenated.
    For DTW, it's often better to treat strokes as separate or use a separator.
    Here we'll just concatenate for simplicity in baseline.
    Warning: Connecting end of stroke 1 to start of stroke 2 might create artifacts.
    """
    points = []
    for stroke in strokes:
        for p in stroke:
            points.append([p['x'], p['y'], p['t']])
    return np.array(points)

def resample_stroke(stroke: List[Dict[str, float]], n: int = 20) -> List[Dict[str, float]]:
    """
    Resamples a stroke to have exactly n points using linear interpolation along path length.
    """
    if not stroke:
        return []
    if len(stroke) == 1:
        return [stroke[0]] * n

    # Extract arrays
    x = np.array([p['x'] for p in stroke])
    y = np.array([p['y'] for p in stroke])
    t = np.array([p['t'] for p in stroke])
    
    # Calculate cumulative distance
    dists = np.sqrt(np.diff(x)**2 + np.diff(y)**2)
    cum_dist = np.concatenate(([0], np.cumsum(dists)))
    total_dist = cum_dist[-1]
    
    if total_dist == 0:
        return [stroke[0]] * n

    # Interact points
    new_dists = np.linspace(0, total_dist, n)
    new_x = np.interp(new_dists, cum_dist, x)
    new_y = np.interp(new_dists, cum_dist, y)
    new_t = np.interp(new_dists, cum_dist, t)
    
    res = []
    for i in range(n):
        res.append({"x": new_x[i], "y": new_y[i], "t": new_t[i]})
    return res

def resample_drawing(strokes: List[List[Dict[str, float]]], points_per_stroke: int = 20) -> List[List[Dict[str, float]]]:
    """
    Resamples every stroke in the drawing.
    """
    return [resample_stroke(s, points_per_stroke) for s in strokes]

def extract_features(strokes: List[List[Dict[str, float]]]) -> np.ndarray:
    """
    Extracts features for ML model. 
    For a complex model, we might rasterize.
    For KNN/DTW, we might just return the resampled points sequence.
    For Random Forest, we need a fixed size vector.
    
    Strategy: Resample to fixed total points (e.g. 5 strokes max, 20 pts each -> 100 pts).
    If fewer strokes, pad. If more, truncate or merge.
    
    Let's go with a simplified approach:
    Flatten all resampled strokes into one sequence of (x,y) coordinates.
    """
    # Calculate global features before normalization
    num_strokes = float(len(strokes))
    
    # Calculate aspect ratio
    all_points = []
    for stroke in strokes:
        for p in stroke:
            all_points.append([p['x'], p['y']])
            
    if all_points:
        arr = np.array(all_points)
        min_vals = np.min(arr, axis=0)
        max_vals = np.max(arr, axis=0)
        width = max_vals[0] - min_vals[0]
        height = max_vals[1] - min_vals[1]
        aspect_ratio = width / height if height > 0 else 0.0
    else:
        aspect_ratio = 0.0

    # Normalize first
    norm_strokes = normalize(strokes)
    # Resample
    resampled = resample_drawing(norm_strokes, points_per_stroke=20)
    
    # Flatten to fixed size?
    # Simple aggregations for baseline:
    # Start point, end point of each stroke?
    # Let's just flatten the first N strokes coordinates.
    
    # For now, let's just return a flattened array of first 5 strokes * 20 points * 2 coords = 200 features
    MAX_STROKES = 5
    POINTS = 20
    
    features = []
    
    for i in range(MAX_STROKES):
        if i < len(resampled):
            s = resampled[i]
            for p in s:
                features.extend([p['x'], p['y']])
        else:
            # Pad with zeros
            features.extend([0.0] * (POINTS * 2))
            
    # Append global features
    features.append(num_strokes)
    features.append(aspect_ratio)
            
    return np.array(features)

def segment_strokes(points: List[Dict[str, float]]) -> List[List[Dict[str, float]]]:
    """
    Segments a flat list of points into strokes based on time difference.
    """
    if not points:
        return []
    if len(points) == 1:
        return [points]
    
    # Calculate deltas
    deltas = []
    for i in range(1, len(points)):
        deltas.append(points[i]['t'] - points[i-1]['t'])
    
    if not deltas:
        return [points]
        
    # Median
    median = float(np.median(deltas))
    
    # Threshold calculation
    # Max of (10 * median) or (0.15s)
    # 0.15s to match frontend implementation plan heuristic
    threshold = max(median * 10, 0.15)
    
    strokes = []
    current_stroke = [points[0]]
    
    for i in range(1, len(points)):
        dt = points[i]['t'] - points[i-1]['t']
        if dt > threshold:
            strokes.append(current_stroke)
            current_stroke = []
        
        current_stroke.append(points[i])
        
    strokes.append(current_stroke)
    return strokes
