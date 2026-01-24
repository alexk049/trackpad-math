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
    
    # Get all trainable symbols from the categorized list
    # The structure is: [{"name": ..., "items": [{"symbol": "...", "description": "..."}, ...]}, ...]
    categorized = get_categorized_symbols()
    all_symbols = []
    for cat in categorized:
        for item in cat["items"]:
            all_symbols.append(item["symbol"])
    
    # Remove duplicates while preserving order
    seen = set()
    unique_symbols = []
    for s in all_symbols:
        if s not in seen:
            unique_symbols.append(s)
            seen.add(s)

    final_list = []
    # Merge existing counts
    for sym in unique_symbols:
        final_list.append({"label": sym, "count": data.get(sym, 0)})
    
    # Add any others that exist in DB but aren't in our 'all_symbols' list
    for label, count in data.items():
        if label not in seen:
             final_list.append({"label": label, "count": count})
             
    # final_list.sort(key=lambda x: x['label']) 
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


@router.get("/api/symbols/categorized")
def get_categorized_symbols():
    """Return symbols grouped by category with descriptions."""
    
    return [
        {
            "name": "1. Basic Mathematics (Foundational)",
            "items": [
                {"symbol": "0", "description": "Digit 0"},
                {"symbol": "1", "description": "Digit 1"},
                {"symbol": "2", "description": "Digit 2"},
                {"symbol": "3", "description": "Digit 3"},
                {"symbol": "4", "description": "Digit 4"},
                {"symbol": "5", "description": "Digit 5"},
                {"symbol": "6", "description": "Digit 6"},
                {"symbol": "7", "description": "Digit 7"},
                {"symbol": "8", "description": "Digit 8"},
                {"symbol": "9", "description": "Digit 9"},
                {"symbol": "+", "description": "Addition"},
                {"symbol": "-", "description": "Subtraction"},
                {"symbol": "\\times", "description": "Multiplication"},
                {"symbol": "\\div", "description": "Division"},
                {"symbol": "=", "description": "Equality"},
                {"symbol": "\\neq", "description": "Inequality"},
                {"symbol": "<", "description": "Less than"},
                {"symbol": ">", "description": "Greater than"},
                {"symbol": "\\le", "description": "Less than or equal to"},
                {"symbol": "\\ge", "description": "Greater than or equal to"},
                {"symbol": "\\pm", "description": "Plus-minus"},
                {"symbol": "%", "description": "Percent"},
                {"symbol": "\\sqrt", "description": "Square root"},
                {"symbol": "|x|", "description": "Absolute value"},
                {"symbol": "^", "description": "Exponentiation"},
                {"symbol": "(", "description": "Left Parenthesis"},
                {"symbol": ")", "description": "Right Parenthesis"},
                {"symbol": "[", "description": "Left Bracket"},
                {"symbol": "]", "description": "Right Bracket"},
                {"symbol": "{", "description": "Left Brace"},
                {"symbol": "}", "description": "Right Brace"},
                {"symbol": "e", "description": "Euler's number"},
                {"symbol": "\\pi", "description": "Pi"},
                {"symbol": "i", "description": "Imaginary unit"}
            ]
        },
        {
            "name": "2. Logic and Set Theory",
            "items": [
                {"symbol": "\\forall", "description": "Universal quantifier (\"For all\")"},
                {"symbol": "\\exists", "description": "Existential quantifier (\"There exists\")"},
                {"symbol": "\\exists!", "description": "Uniqueness quantifier"},
                {"symbol": "\\neg", "description": "Negation (\"Not\")"},
                {"symbol": "\\wedge", "description": "Conjunction (\"And\")"},
                {"symbol": "\\vee", "description": "Disjunction (\"Or\")"},
                {"symbol": "\\oplus", "description": "Exclusive OR"},
                {"symbol": "\\implies", "description": "Material implication (\"If... then\")"},
                {"symbol": "\\iff", "description": "Biconditional (\"If and only if\")"},
                {"symbol": "\\therefore", "description": "Therefore"},
                {"symbol": "\\because", "description": "Because"},
                {"symbol": "\\in", "description": "Element of"},
                {"symbol": "\\notin", "description": "Not an element of"},
                {"symbol": "\\subset", "description": "Proper subset"},
                {"symbol": "\\subseteq", "description": "Subset"},
                {"symbol": "\\cup", "description": "Union"},
                {"symbol": "\\cap", "description": "Intersection"},
                {"symbol": "A^c", "description": "Complement of set A"},
                {"symbol": "\\bar{A}", "description": "Complement (alt)"},
                {"symbol": "\\setminus", "description": "Set difference"},
                {"symbol": "\\mathcal{P}", "description": "Power set"},
                {"symbol": "\\aleph_0", "description": "Aleph-null"}
            ]
        },
        {
            "name": "3. Algebra and Number Theory",
            "items": [
                {"symbol": "\\mid", "description": "Divisibility"},
                {"symbol": "\\pmod", "description": "Congruence modulo"},
                {"symbol": "\\gcd", "description": "Greatest common divisor"},
                {"symbol": "\\sum", "description": "Summation"},
                {"symbol": "\\prod", "description": "Product"},
                {"symbol": "!", "description": "Factorial"},
                {"symbol": "\\binom", "description": "Binomial coefficient"},
                {"symbol": "\\lfloor", "description": "Floor"},
                {"symbol": "\\lceil", "description": "Ceiling"},
                {"symbol": "\\mathbb{N}", "description": "Natural numbers"},
                {"symbol": "\\mathbb{Z}", "description": "Integer numbers"},
                {"symbol": "\\mathbb{Q}", "description": "Rational numbers"},
                {"symbol": "\\mathbb{R}", "description": "Real numbers"},
                {"symbol": "\\mathbb{C}", "description": "Complex numbers"},
                {"symbol": "\\mathbb{H}", "description": "Quaternions"}
            ]
        },
        {
            "name": "4. Calculus and Analysis",
            "items": [
                {"symbol": "\\lim", "description": "Limit"},
                {"symbol": "f'", "description": "Derivative"},
                {"symbol": "\\partial", "description": "Partial derivative"},
                {"symbol": "\\int", "description": "Indefinite integral"},
                {"symbol": "\\oint", "description": "Contour integral"},
                {"symbol": "\\iint", "description": "Double integral"},
                {"symbol": "\\nabla", "description": "Del/Nabla"},
                {"symbol": "\\Delta", "description": "Laplacian"},
                {"symbol": "\\epsilon", "description": "Epsilon (small quantity)"},
                {"symbol": "\\delta", "description": "Delta (small quantity)"},
                {"symbol": "\\infty", "description": "Infinity"}
            ]
        },
        {
            "name": "5. Linear Algebra and Vector Calculus",
            "items": [
                {"symbol": "\\vec{v}", "description": "Vector"},
                {"symbol": "\\|v\\|", "description": "Norm"},
                {"symbol": "\\cdot", "description": "Dot product"},
                {"symbol": "\\times", "description": "Cross product"},
                {"symbol": "\\langle", "description": "Inner product (left)"},
                {"symbol": "\\rangle", "description": "Inner product (right)"},
                {"symbol": "^T", "description": "Transpose"},
                {"symbol": "^H", "description": "Conjugate transpose"},
                {"symbol": "\\det", "description": "Determinant"},
                {"symbol": "\\text{tr}", "description": "Trace"},
                {"symbol": "\\mathbf{I}", "description": "Identity matrix"}
            ]
        },
        {
            "name": "6. Geometry and Trigonometry",
            "items": [
                {"symbol": "\\angle", "description": "Angle"},
                {"symbol": "\\perp", "description": "Perpendicular"},
                {"symbol": "\\parallel", "description": "Parallel"},
                {"symbol": "\\cong", "description": "Congruent"},
                {"symbol": "\\sim", "description": "Similar"},
                {"symbol": "\\triangle", "description": "Triangle"},
                {"symbol": "\\theta", "description": "Theta"},
                {"symbol": "\\phi", "description": "Phi"},
                {"symbol": "\\alpha", "description": "Alpha"},
                {"symbol": "\\beta", "description": "Beta"},
                {"symbol": "\\sin", "description": "Sine"},
                {"symbol": "\\cos", "description": "Cosine"},
                {"symbol": "\\tan", "description": "Tangent"},
                {"symbol": "\\sinh", "description": "Hyperbolic Sine"},
                {"symbol": "\\cosh", "description": "Hyperbolic Cosine"},
                {"symbol": "\\tanh", "description": "Hyperbolic Tangent"}
            ]
        },
        {
            "name": "7. Abstract Algebra and Category Theory",
            "items": [
                {"symbol": "\\triangleleft", "description": "Normal subgroup"},
                {"symbol": "/", "description": "Quotient"},
                {"symbol": "\\ker", "description": "Kernel"},
                {"symbol": "\\text{Im}", "description": "Image"},
                {"symbol": "\\otimes", "description": "Tensor product"},
                {"symbol": "\\text{Hom}", "description": "Homomorphism set"},
                {"symbol": "\\circ", "description": "Composition"}
            ]
        },
        {
            "name": "8. Probability and Statistics",
            "items": [
                {"symbol": "P(A)", "description": "Probability"},
                {"symbol": "P(A \\mid B)", "description": "Conditional Probability"},
                {"symbol": "E[X]", "description": "Expected Value"},
                {"symbol": "\\text{Var}", "description": "Variance"},
                {"symbol": "\\mu", "description": "Population mean"},
                {"symbol": "\\sigma", "description": "Standard deviation"},
                {"symbol": "\\bar{x}", "description": "Sample mean"},
                {"symbol": "s", "description": "Sample standard deviation"},
                {"symbol": "\\chi^2", "description": "Chi-squared"}
            ]
        }
    ]
