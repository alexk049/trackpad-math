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
def train(model: str = typer.Option("knn", "--model", "-m", help="Model type: knn, rf, dtw")):
    """Train the model on all data in the database."""
    db = next(get_db())
    drawings = db.query(Drawing).all()
    
    if not drawings:
        typer.echo("No drawings found to train on.")
        return

    typer.echo(f"Training {model.upper()} model on {len(drawings)} samples...")
    
    classifier = SymbolClassifier(model_type=model)
    classifier.train(drawings, [d.label for d in drawings])
    typer.echo(f"Training complete. Model saved to {classifier.model_path}.")

@app.command()
def predict(
    model: str = typer.Option("knn", "--model", "-m", help="Model type: knn, rf, dtw"),
    feedback: bool = typer.Option(False, "--feedback", "-f", help="Enable feedback loop to improve model")
):
    """
    Start a prediction session. Draw and get real-time prediction.
    """
    classifier = SymbolClassifier(model_type=model)
    
    if not classifier.load():
        typer.echo(f"Model {model} not found. Please train first: trackpad-chars train --model {model}")
        return

    typer.echo(f"PREDICTION MODE ({model.upper()})")
    if feedback:
        typer.echo("FEEDBACK MODE ENABLED: You will be asked to verify predictions.")
        
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
                
            predictions = classifier.predict(strokes)
            
            if not predictions:
                typer.echo("No predictions returned.")
                continue
                
            pred, conf = predictions[0]
            
            typer.echo(f"PREDICTION: {pred} (Score: {conf:.2f})")
            
            if len(predictions) > 1:
                typer.echo("Alternatives:")
                for alt_pred, alt_conf in predictions[1:]:
                    if alt_conf > 0:
                         typer.echo(f"- {alt_pred}: {alt_conf:.2f}")
            
            if feedback:
                # Ask for feedback
                user_input = typer.prompt(f"Is '{pred}' correct? [y/n/CORRECT_LABEL]", default="y")
                correct_label = None
                
                if user_input.lower() in ('y', 'yes'):
                    correct_label = pred
                    # Optional: We could reinforce here too, but maybe overkill? 
                    # Let's reinforce positive feedback too!
                    typer.echo("Good! Reinforcing model...")
                elif user_input.lower() in ('n', 'no'):
                    correct_label = typer.prompt("What is the correct label?")
                else:
                    # User typed the label directly
                    correct_label = user_input
                
                if correct_label:
                    # Save to DB
                    db = next(get_db())
                    drawing = Drawing(label=correct_label, strokes=strokes)
                    db.add(drawing)
                    db.commit()
                    
                    # Update model
                    classifier.add_example(strokes, correct_label)
                    typer.echo(f"Saved example for '{correct_label}' and updated model.")
            
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

@app.command()
def serve(
    host: str = "0.0.0.0",
    port: int = 8001,
    reload: bool = True
):
    """Start the web server."""
    import uvicorn
    # Use string reference to allow reload to work
    uvicorn.run("trackpad_chars.app:app", host=host, port=port, reload=reload)

if __name__ == "__main__":
    app()
