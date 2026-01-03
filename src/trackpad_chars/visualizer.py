import streamlit as st
import pandas as pd
import matplotlib.pyplot as plt
from trackpad_chars.db import get_db, Drawing
from trackpad_chars.processing import segment_strokes

def main():
    st.set_page_config(page_title="Trackpad Chars Visualizer", page_icon="✏️")
    st.sidebar.title("Drawing Visualizer")

    # Connect to DB
    try:
        db = next(get_db())
    except Exception as e:
        st.error(f"Could not connect to database: {e}")
        return

    # Fetch all labels
    labels = [r[0] for r in db.query(Drawing.label).distinct().all()]
    
    if not labels:
        st.warning("No data found in database.")
        return

    labels.sort()
    
    # Sidebar selection
    selected_label = st.sidebar.selectbox("Select Label", labels)
    
    # Initialize session state for tracking label change
    if 'last_selected_label' not in st.session_state:
        st.session_state.last_selected_label = selected_label

    # Reset index if label changes
    if selected_label != st.session_state.last_selected_label:
        st.session_state.sample_index = 0
        st.session_state.last_selected_label = selected_label
        st.rerun()
    
    # Fetch drawings for selected label
    drawings = db.query(Drawing).filter(Drawing.label == selected_label).all()
    
    if not drawings:
        st.info(f"No drawings found for label '{selected_label}'")
        return

    st.sidebar.markdown(f"**Total Samples:** {len(drawings)}")
    
    # Initialize session state for index
    if 'sample_index' not in st.session_state:
        st.session_state.sample_index = 0
        
    # Ensure index is valid for current selection
    if st.session_state.sample_index >= len(drawings):
        st.session_state.sample_index = 0

    # Navigation buttons
    col1, col2 = st.sidebar.columns(2)
    if col1.button("Previous"):
        st.session_state.sample_index = max(0, st.session_state.sample_index - 1)
        st.rerun()
    if col2.button("Next"):
        st.session_state.sample_index = min(len(drawings) - 1, st.session_state.sample_index + 1)
        st.rerun()
    
    # Sample selector synced with session state
    index = st.sidebar.slider("Sample Index", 0, len(drawings)-1, key="sample_index")
    drawing = drawings[index]
    
    # Main display
    st.markdown(f"**Label:** '{selected_label}' (**ID:** {drawing.id})")
    st.text(f"Timestamp: {drawing.timestamp}")
    
    points = drawing.points
    strokes = segment_strokes(points)
    st.text(f"Strokes: {len(strokes)} | Total Points: {len(points)}")

    # Plotting
    if strokes:
        fig, ax = plt.subplots(figsize=(6, 6))
        ax.set_xlim(0, 2000) # Assuming roughly 1920x1080 screen, but coordinates might vary
        ax.set_ylim(2000, 0)  # Inverted Y for screen coords
        
        # Determine bounds dynamically if possible, or stick to fixed if normalized.
        # Let's compute bounds from data to be safe
        all_x = []
        all_y = []
        for stroke in strokes:
            xs = [p['x'] for p in stroke]
            ys = [p['y'] for p in stroke]
            all_x.extend(xs)
            all_y.extend(ys)
            ax.plot(xs, ys, marker='.', linestyle='-')
            
        if all_x and all_y:
            margin = 100
            ax.set_xlim(min(all_x) - margin, max(all_x) + margin)
            ax.set_ylim(max(all_y) + margin, min(all_y) - margin) # Invert Y

        ax.set_aspect('equal')
        st.pyplot(fig)
    else:
        st.warning("Empty drawing (no strokes).")

if __name__ == "__main__":
    main()
