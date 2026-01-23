import json
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from trackpad_chars.db import get_db, Drawing
from trackpad_chars.state import classifier

router = APIRouter()

class TeachRequest(BaseModel):
    label: str
    points: Optional[list] = None # If None, use last recorded points

@router.get("/api/labels")
def get_labels(db: Session = Depends(get_db)):
    """Get all unique labels and their counts."""
    results = db.query(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label).all()
    data = {r[0]: r[1] for r in results}
    
    # User requested ALL trainable symbols to be present
    all_symbols = [str(i) for i in range(10)] + \
                  [chr(i) for i in range(ord('a'), ord('z')+1)] + \
                  ['summation', 'square root', 'integral', '/', '+', '-', '(', ')', '=', 'plus minus', '^', '.'] 
    
    final_list = []
    # Merge existing counts
    for sym in all_symbols:
        final_list.append({"label": sym, "count": data.get(sym, 0)})
    
    # Add any others that exist but aren't in our 'all_symbols' list
    for label, count in data.items():
        if label not in all_symbols:
             final_list.append({"label": label, "count": count})
             
    final_list.sort(key=lambda x: x['label'])
    return final_list

@router.get("/api/drawings")
def get_drawings(label: Optional[str] = None, limit: int = 100, db: Session = Depends(get_db)):
    """Get list of drawings, optionally filtered by label."""
    q = db.query(Drawing)
    if label:
        q = q.filter(Drawing.label == label)
    drawings = q.order_by(Drawing.timestamp.desc()).limit(limit).all()
    return drawings

@router.get("/api/drawings/{id}")
def get_drawing(id: UUID, db: Session = Depends(get_db)):
    d = db.query(Drawing).filter(Drawing.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drawing not found")
    return d

@router.delete("/api/drawings/{id}")
def delete_drawing(id: UUID, db: Session = Depends(get_db)):
    d = db.query(Drawing).filter(Drawing.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Drawing not found")
    db.delete(d)
    db.commit()
    return {"status": "deleted"}

@router.post("/api/teach")
async def teach_symbol(req: TeachRequest, db: Session = Depends(get_db)):
    """
    Save points as a specific label and incrementally update the model.
    """
    points_to_save = req.points
    
    if not points_to_save:
         raise HTTPException(status_code=400, detail="No points provided")

    new_drawing = Drawing(
        label=req.label,
        points=points_to_save
    )
    db.add(new_drawing)
    db.commit()
    
    # Incrementally update the model with the new example
    try:
        classifier.add_example(points_to_save, req.label)
        model_updated = True
    except Exception as e:
        print(f"Warning: Could not update model incrementally: {e}")
        model_updated = False
    
    return {"status": "saved", "id": str(new_drawing.id), "model_updated": model_updated}

@router.post("/api/retrain")
def retrain_model():
    """Force model reload/retrain from DB."""
    # Not implemented fully yet
    return {"status": "not_implemented_yet"}

# --- Import / Export ---

@router.get("/api/data/export")
def export_data(db: Session = Depends(get_db)):
    """Export all training data as JSON."""
    drawings = db.query(Drawing).all()
    data = []
    for d in drawings:
        data.append({
            "label": d.label,
            "points": d.points,
            "created_at": d.timestamp.isoformat() if d.timestamp else None
        })
    # Return as download with filename
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": "attachment; filename=training_data.json"}
    )

@router.post("/api/data/import")
async def import_data(file: UploadFile, db: Session = Depends(get_db)):
    """Import training data from JSON file."""
    try:
        content = await file.read()
        data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {e}")
        
    if not isinstance(data, list):
         raise HTTPException(status_code=400, detail="JSON must be a list of drawings")
         
    count = 0
    for item in data:
        if "label" not in item or "points" not in item:
            continue
            
        # Basic validation passed
        d = Drawing(
            label=item["label"],
            points=item["points"]
            # Ignore timestamp on import, let it be now
        )
        db.add(d)
        count += 1
        
    db.commit()

    # Retrain model with all imported data
    try:
        classifier.train([item["points"] for item in data if "points" in item and "label" in item], 
                         [item["label"] for item in data if "points" in item and "label" in item])
    except Exception as e:
        print(f"Warning: Could not retrain model after import: {e}")
    
    return {"status": "imported", "count": count}

@router.delete("/api/data/reset")
def reset_data(db: Session = Depends(get_db)):
    """Delete ALL training data and reset classifier."""
    try:
        db.query(Drawing).delete()
        db.commit()
        classifier.reset()
        return {"status": "reset"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
