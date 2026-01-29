import sys
import os
import json

import uuid
import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy import create_engine, Column, String, DateTime, func, Integer, Uuid, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

class Drawing(Base):
    __tablename__ = "drawings"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    label: Mapped[str] = mapped_column(String, index=True)
    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # points is a flat list of points. Each point is {x, y, t}
    points: Mapped[List[Dict[str, float]]] = mapped_column(JSON)

class DBSetting(Base):
    __tablename__ = "settings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    auto_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    pause_threshold: Mapped[int] = mapped_column(Integer, default=1000)
    equation_scroll_x_sensitivity: Mapped[int] = mapped_column(Integer, default=20)
    equation_scroll_y_sensitivity: Mapped[int] = mapped_column(Integer, default=20)

def init_db():
    Base.metadata.create_all(bind=engine)

def seed_db_if_empty():
    db = SessionLocal()
    try:
        # Check if settings exist (and create default if not)
        if not db.query(DBSetting).first():
            db.add(DBSetting(id=1))
            db.commit()

        # Check if drawings exist
        if db.query(Drawing).first():
            return

        if getattr(sys, 'frozen', False):
            # Running in a PyInstaller bundle
            base_path = sys._MEIPASS
            seed_file = os.path.join(base_path, "trackpad_math", "data", "seed_drawings.json")
        else:
            # Running in normal python environment
            seed_file = os.path.join(os.path.dirname(__file__), "data", "seed_drawings.json")
            
        if not os.path.exists(seed_file):
            print(f"Seed file not found: {seed_file}")
            return

        with open(seed_file, "r") as f:
            drawings_data = json.load(f)

        for d in drawings_data:
            db.add(Drawing(label=d["label"], points=d["points"]))
        
        db.commit()
        print(f"Seeded {len(drawings_data)} drawings.")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
