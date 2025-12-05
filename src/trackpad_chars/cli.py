import typer
from typing import Optional
from sqlalchemy import func
import time
import sys
import click

from trackpad_chars.db import get_db, Drawing, init_db
from trackpad_chars.recorder import recorder
from trackpad_chars.model import SymbolClassifier

app = typer.Typer()
classifier = SymbolClassifier()

@app.command()
def init():
    """Initialize the database tables."""
    init_db()
    typer.echo("Database initialized.")

def wait_for_space(prompt: str):
    typer.echo(prompt, nl=False)
    while True:
        c = click.getchar()
        if c == ' ':
            break
        if c == '\x03': # Ctrl+C
            raise KeyboardInterrupt()
    typer.echo() # Move to next line

@app.command()
def collect(label: str, count: int = 1):
    """
    Collect training data for a specific label.
    """
    db = next(get_db())
    typer.echo(f"Collecting {count} drawings for label '{label}'...")
    
    for i in range(count):
        typer.echo(f"\n--- Drawing {i+1}/{count} ---")
        wait_for_space("Press SPACE to START recording...")
        recorder.reset_cursor()
        
        recorder.start()
        typer.echo("RECORDING... (Draw on your trackpad)")
        
        # We need to wait for user to finish.
        wait_for_space("Press SPACE to STOP recording...")
        
        strokes = recorder.stop()
        typer.echo(f"Captured {len(strokes)} strokes.")
        
        if not strokes:
            typer.echo("No strokes detected. Discarding.")
            continue
            
        # Save to DB
        drawing = Drawing(label=label, strokes=strokes)
        db.add(drawing)
        db.commit()
        typer.echo("Saved.")
        
    typer.echo("Done collection.")

@app.command()
def stats():
    """Show dataset statistics."""
    db = next(get_db())
    results = db.query(Drawing.label, func.count(Drawing.id)).group_by(Drawing.label).all()
    
    typer.echo("Dataset Stats:")
    typer.echo("--------------")
    for label, count in results:
        typer.echo(f"{label}: {count}")

@app.command()
def delete(label: str, force: bool = typer.Option(False, "--force", "-f", help="Force deletion without confirmation")):
    """Delete all drawings for a specific label."""
    db = next(get_db())
    
    # Check count first
    count = db.query(Drawing).filter(Drawing.label == label).count()
    if count == 0:
        typer.echo(f"No drawings found for label '{label}'.")
        return

    if not force:
        typer.confirm(f"Are you sure you want to delete {count} drawings for label '{label}'?", abort=True)
    
    db.query(Drawing).filter(Drawing.label == label).delete()
    db.commit()
    typer.echo(f"Deleted {count} drawings for label '{label}'.")

@app.command()
def train():
    """Train the model on all data in the database."""
    db = next(get_db())
    drawings = db.query(Drawing).all()
    
    if not drawings:
        typer.echo("No drawings found to train on.")
        return

    typer.echo(f"Training on {len(drawings)} samples...")
    # Extract strokes and labels
    # We pass the Drawing objects directly as model expect that interface or we adapt
    # The model implementation I wrote earlier expects objects with .strokes attribute or similar
    classifier.train(drawings, [d.label for d in drawings])
    typer.echo("Training complete. Model saved.")

@app.command()
def predict():
    """
    Start a prediction session. Draw and get real-time prediction.
    """
    if not classifier.load():
        typer.echo("Model not found. Please train first.")
        # We can allow running if we train on the fly? No.
        return

    typer.echo("PREDICTION MODE")
    typer.echo("Press SPACE to START recording. Press SPACE again to STOP.")
    typer.echo("Press Ctrl+C to exit.")
    
    while True:
        try:
            wait_for_space("\nReady? Press SPACE to START...")
            recorder.reset_cursor()
            recorder.start()
            typer.echo("Rec...")
            wait_for_space("Press SPACE to STOP...")
            strokes = recorder.stop()
            
            if not strokes:
                typer.echo("No strokes.")
                continue
                
            pred, conf = classifier.predict(strokes)
            typer.echo(f"PREDICTION: {pred} (Conf: {conf:.2f})")
            
        except KeyboardInterrupt:
            typer.echo("\nExiting prediction mode.")
            break

@app.command()
def visualize():
    """
    Start the GUI visualizer to explore collected data.
    """
    import subprocess
    import sys
    import os
    
    script_path = os.path.join(os.path.dirname(__file__), "visualizer.py")
    
    typer.echo("Starting visualizer...")
    subprocess.run(["streamlit", "run", script_path], check=False)

if __name__ == "__main__":
    app()
