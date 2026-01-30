import json
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from trackpad_math.db import get_db, Drawing
from trackpad_math import state

router = APIRouter()

class TeachRequest(BaseModel):
    label: str
    points: Optional[list] = None # If None, use last recorded points

@router.get("/api/labels")
def get_labels(db: Session = Depends(get_db)):
    """Get all unique labels and their counts, with descriptions."""
    results = db.query(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label).all()
    data = {r[0]: r[1] for r in results}
    
    # Get all trainable symbols from the categorized list
    categorized = get_categorized_symbols()
    
    # Map symbol -> {description, latex}
    symbol_info = {}
    ordered_symbols = []
    for cat in categorized:
        for item in cat["items"]:
            sym = item["symbol"]
            if sym not in symbol_info:
                ordered_symbols.append(sym)
                symbol_info[sym] = {
                    "description": item.get("description", ""),
                    "latex": item.get("latex", "")
                }
    
    final_list = []
    seen_labels = set()
    
    # First, add all predefined symbols in order
    for sym in ordered_symbols:
        info = symbol_info[sym]
        final_list.append({
            "label": sym,
            "count": data.get(sym, 0),
            "description": info["description"],
            "latex": info["latex"]
        })
        seen_labels.add(sym)
    
    # Then add any labels that exist in DB but aren't in categorized list
    for label, count in data.items():
        if label not in seen_labels:
             final_list.append({
                 "label": label, 
                 "count": count,
                 "description": "",
                 "latex": ""
             })
             
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
        state.classifier.add_example(points_to_save, req.label)
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
        state.classifier.train([item["points"] for item in data if "points" in item and "label" in item], 
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
        state.classifier.reset()
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
                {"latex": "0", "description": "", "symbol": "0"},
                {"latex": "1", "description": "", "symbol": "1"},
                {"latex": "2", "description": "", "symbol": "2"},
                {"latex": "3", "description": "", "symbol": "3"},
                {"latex": "4", "description": "", "symbol": "4"},
                {"latex": "5", "description": "", "symbol": "5"},
                {"latex": "6", "description": "", "symbol": "6"},
                {"latex": "7", "description": "", "symbol": "7"},
                {"latex": "8", "description": "", "symbol": "8"},
                {"latex": "9", "description": "", "symbol": "9"},
                {"latex": "a", "description": "", "symbol": "a"},
                {"latex": "b", "description": "", "symbol": "b"},
                {"latex": "c", "description": "", "symbol": "c"},
                {"latex": "d", "description": "", "symbol": "d"},
                {"latex": "e", "description": "Euler's number", "symbol": "e"},
                {"latex": "f", "description": "", "symbol": "f"},
                {"latex": "g", "description": "", "symbol": "g"},
                {"latex": "h", "description": "", "symbol": "h"},
                {"latex": "i", "description": "Imaginary unit", "symbol": "i"},
                {"latex": "j", "description": "", "symbol": "j"},
                {"latex": "k", "description": "", "symbol": "k"},
                {"latex": "l", "description": "", "symbol": "l"},
                {"latex": "m", "description": "", "symbol": "m"},
                {"latex": "n", "description": "", "symbol": "n"},
                {"latex": "o", "description": "", "symbol": "o"},
                {"latex": "p", "description": "", "symbol": "p"},
                {"latex": "q", "description": "", "symbol": "q"},
                {"latex": "r", "description": "", "symbol": "r"},
                {"latex": "s", "description": "", "symbol": "s"},
                {"latex": "t", "description": "", "symbol": "t"},
                {"latex": "u", "description": "", "symbol": "u"},
                {"latex": "v", "description": "", "symbol": "v"},
                {"latex": "w", "description": "", "symbol": "w"},
                {"latex": "x", "description": "", "symbol": "x"},
                {"latex": "y", "description": "", "symbol": "y"},
                {"latex": "z", "description": "", "symbol": "z"},
                {"latex": ".", "description": "Decimal Point", "symbol": "."},
                {"latex": ",", "description": "Comma", "symbol": ","},
                {"latex": "+", "description": "Plus", "symbol": "+"},
                {"latex": "-", "description": "Minus", "symbol": "-"},
                {"latex": "\\times", "description": "Multiplication", "symbol": "×"},
                {"latex": "\\div", "description": "Division", "symbol": "÷"},
                {"latex": "=", "description": "Equality", "symbol": "="},
                {"latex": "\\neq", "description": "Inequality", "symbol": "≠"},
                {"latex": "<", "description": "Less than", "symbol": "<"},
                {"latex": ">", "description": "Greater than", "symbol": ">"},
                {"latex": "\\le", "description": "Less than or equal to", "symbol": "≤"},
                {"latex": "\\ge", "description": "Greater than or equal to", "symbol": "≥"},
                {"latex": "\\pm", "description": "Plus-minus", "symbol": "±"},
                {"latex": "%", "description": "Percent", "symbol": "%"},
                {"latex": "\\sqrt", "description": "Square root", "symbol": "√"},
                {"latex": "|x|", "description": "Absolute value", "symbol": "|x|"},
                {"latex": "^", "description": "Exponentiation", "symbol": "^"},
                {"latex": "(", "description": "Left Parenthesis", "symbol": "("},
                {"latex": ")", "description": "Right Parenthesis", "symbol": ")"},
                {"latex": "[", "description": "Left Bracket", "symbol": "["},
                {"latex": "]", "description": "Right Bracket", "symbol": "]"},
                {"latex": "{", "description": "Left Brace", "symbol": "{"},
                {"latex": "}", "description": "Right Brace", "symbol": "}"},
                {"latex": "\\pi", "description": "Pi", "symbol": "π"}
            ]
        },
        {
            "name": "2. Logic and Set Theory",
            "items": [
                {"latex": "\\forall", "description": "Universal quantifier (\"For all\")", "symbol": "∀"},
                {"latex": "\\exists", "description": "Existential quantifier (\"There exists\")", "symbol": "∃"},
                {"latex": "\\exists!", "description": "Uniqueness quantifier", "symbol": "∃!"},
                {"latex": "\\neg", "description": "Negation (\"Not\")", "symbol": "¬"},
                {"latex": "\\wedge", "description": "Conjunction (\"And\")", "symbol": "∧"},
                {"latex": "\\vee", "description": "Disjunction (\"Or\")", "symbol": "∨"},
                {"latex": "\\oplus", "description": "Exclusive OR", "symbol": "⊕"},
                {"latex": "\\implies", "description": "Material implication (\"If... then\")", "symbol": "⇒"},
                {"latex": "\\iff", "description": "Biconditional (\"If and only if\")", "symbol": "⇔"},
                {"latex": "\\therefore", "description": "Therefore", "symbol": "∴"},
                {"latex": "\\because", "description": "Because", "symbol": "∵"},
                {"latex": "\\in", "description": "Element of", "symbol": "∈"},
                {"latex": "\\notin", "description": "Not an element of", "symbol": "∉"},
                {"latex": "\\subset", "description": "Proper subset", "symbol": "⊂"},
                {"latex": "\\subseteq", "description": "Subset", "symbol": "⊆"},
                {"latex": "\\cup", "description": "Union", "symbol": "∪"},
                {"latex": "\\cap", "description": "Intersection", "symbol": "∩"},
                {"latex": "A^c", "description": "Complement of set A", "symbol": "Aᶜ"},
                {"latex": "\\bar{A}", "description": "Complement (alt)", "symbol": "Ā"},
                {"latex": "\\setminus", "description": "Set difference", "symbol": "∖"},
                {"latex": "\\mathcal{P}", "description": "Power set", "symbol": "𝒫"},
                {"latex": "\\aleph_0", "description": "Aleph-null", "symbol": "ℵ₀"}
            ]
        },
        {
            "name": "3. Algebra and Number Theory",
            "items": [
                {"latex": "\\mid", "description": "Divisibility", "symbol": "∣"},
                {"latex": "\\pmod", "description": "Congruence modulo", "symbol": "mod"},
                {"latex": "\\gcd", "description": "Greatest common divisor", "symbol": "gcd"},
                {"latex": "\\sum", "description": "Summation", "symbol": "∑"},
                {"latex": "\\prod", "description": "Product", "symbol": "∏"},
                {"latex": "!", "description": "Factorial", "symbol": "!"},
                {"latex": "\\binom", "description": "Binomial coefficient", "symbol": "()"},
                {"latex": "\\lfloor", "description": "Floor", "symbol": "⌊"},
                {"latex": "\\lceil", "description": "Ceiling", "symbol": "⌈"},
                {"latex": "\\mathbb{N}", "description": "Natural numbers", "symbol": "ℕ"},
                {"latex": "\\mathbb{Z}", "description": "Integer numbers", "symbol": "ℤ"},
                {"latex": "\\mathbb{Q}", "description": "Rational numbers", "symbol": "ℚ"},
                {"latex": "\\mathbb{R}", "description": "Real numbers", "symbol": "ℝ"},
                {"latex": "\\mathbb{C}", "description": "Complex numbers", "symbol": "ℂ"},
                {"latex": "\\mathbb{H}", "description": "Quaternions", "symbol": "ℍ"}
            ]
        },
        {
            "name": "4. Calculus and Analysis",
            "items": [
                {"latex": "\\lim", "description": "Limit", "symbol": "lim"},
                {"latex": "f'", "description": "Derivative", "symbol": "f'"},
                {"latex": "\\partial", "description": "Partial derivative", "symbol": "∂"},
                {"latex": "\\int", "description": "Indefinite integral", "symbol": "∫"},
                {"latex": "\\oint", "description": "Contour integral", "symbol": "∮"},
                {"latex": "\\iint", "description": "Double integral", "symbol": "∬"},
                {"latex": "\\nabla", "description": "Del/Nabla", "symbol": "∇"},
                {"latex": "\\Delta", "description": "Laplacian", "symbol": "Δ"},
                {"latex": "\\epsilon", "description": "Epsilon (small quantity)", "symbol": "ε"},
                {"latex": "\\delta", "description": "Delta (small quantity)", "symbol": "δ"},
                {"latex": "\\infty", "description": "Infinity", "symbol": "∞"}
            ]
        },
        {
            "name": "5. Linear Algebra and Vector Calculus",
            "items": [
                {"latex": "\\vec{v}", "description": "Vector", "symbol": "v⃗"},
                {"latex": "\\|v\\|", "description": "Norm", "symbol": "||v||"},
                {"latex": "\\cdot", "description": "Dot product", "symbol": "⋅"},
                {"latex": "\\times", "description": "Cross product", "symbol": "×"},
                {"latex": "\\langle", "description": "Inner product (left)", "symbol": "⟨"},
                {"latex": "\\rangle", "description": "Inner product (right)", "symbol": "⟩"},
                {"latex": "^T", "description": "Transpose", "symbol": "ᵀ"},
                {"latex": "^H", "description": "Conjugate transpose", "symbol": "ᴴ"},
                {"latex": "\\det", "description": "Determinant", "symbol": "det"},
                {"latex": "\\text{tr}", "description": "Trace", "symbol": "tr"},
                {"latex": "\\mathbf{I}", "description": "Identity matrix", "symbol": "I"}
            ]
        },
        {
            "name": "6. Geometry and Trigonometry",
            "items": [
                {"latex": "\\angle", "description": "Angle", "symbol": "∠"},
                {"latex": "\\perp", "description": "Perpendicular", "symbol": "⊥"},
                {"latex": "\\parallel", "description": "Parallel", "symbol": "∥"},
                {"latex": "\\cong", "description": "Congruent", "symbol": "≅"},
                {"latex": "\\sim", "description": "Similar", "symbol": "∼"},
                {"latex": "\\triangle", "description": "Triangle", "symbol": "△"},
                {"latex": "\\theta", "description": "Theta", "symbol": "θ"},
                {"latex": "\\phi", "description": "Phi", "symbol": "φ"},
                {"latex": "\\alpha", "description": "Alpha", "symbol": "α"},
                {"latex": "\\beta", "description": "Beta", "symbol": "β"},
                {"latex": "\\sin", "description": "Sine", "symbol": "sin"},
                {"latex": "\\cos", "description": "Cosine", "symbol": "cos"},
                {"latex": "\\tan", "description": "Tangent", "symbol": "tan"},
                {"latex": "\\sinh", "description": "Hyperbolic Sine", "symbol": "sinh"},
                {"latex": "\\cosh", "description": "Hyperbolic Cosine", "symbol": "cosh"},
                {"latex": "\\tanh", "description": "Hyperbolic Tangent", "symbol": "tanh"}
            ]
        },
        {
            "name": "7. Abstract Algebra and Category Theory",
            "items": [
                {"latex": "\\triangleleft", "description": "Normal subgroup", "symbol": "⊲"},
                {"latex": "/", "description": "Quotient", "symbol": "/"},
                {"latex": "\\ker", "description": "Kernel", "symbol": "ker"},
                {"latex": "\\text{Im}", "description": "Image", "symbol": "Im"},
                {"latex": "\\otimes", "description": "Tensor product", "symbol": "⊗"},
                {"latex": "\\text{Hom}", "description": "Homomorphism set", "symbol": "Hom"},
                {"latex": "\\circ", "description": "Composition", "symbol": "∘"}
            ]
        },
        {
            "name": "8. Probability and Statistics",
            "items": [
                {"latex": "P(A)", "description": "Probability", "symbol": "P(A)"},
                {"latex": "P(A \\mid B)", "description": "Conditional Probability", "symbol": "P(A|B)"},
                {"latex": "E[X]", "description": "Expected Value", "symbol": "E[X]"},
                {"latex": "\\text{Var}", "description": "Variance", "symbol": "Var"},
                {"latex": "\\mu", "description": "Population mean", "symbol": "μ"},
                {"latex": "\\sigma", "description": "Standard deviation", "symbol": "σ"},
                {"latex": "\\bar{x}", "description": "Sample mean", "symbol": "x̄"},
                {"latex": "s", "description": "Sample standard deviation", "symbol": "s"},
                {"latex": "\\chi^2", "description": "Chi-squared", "symbol": "χ²"}
            ]
        }
    ]
