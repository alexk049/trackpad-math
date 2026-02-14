import sys
import os
import json
import uuid
import datetime
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

from sqlalchemy import create_engine, Column, String, DateTime, func, Integer, Uuid, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

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
    pause_threshold: Mapped[int] = mapped_column(Integer, default=400)
    equation_scroll_x_sensitivity: Mapped[int] = mapped_column(Integer, default=20)
    equation_scroll_y_sensitivity: Mapped[int] = mapped_column(Integer, default=20)

class Database:
    def __init__(self):
        self.engine = None
        self.SessionLocal = None

    def connect(self):
        """Explicitly initialize the engine and session factory."""
        if self.engine is None:
            database_url = os.getenv("DATABASE_URL")
            if not database_url:
                database_url = "sqlite:///./app.db"
            
            self.engine = create_engine(
                database_url, 
                connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
            )
            self.SessionLocal = sessionmaker(
                autocommit=False, 
                autoflush=False, 
                bind=self.engine
            )

    @contextmanager
    def session_scope(self):
        """Context manager for database sessions."""
        if self.SessionLocal is None:
            self.connect()
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.commit()
            session.close()

    def init_db(self):
        """Creates tables if they don't exist."""
        self.connect()
        Base.metadata.create_all(bind=self.engine)

    def seed_if_empty(self):
        """Seeds the database with default settings and symbols if it's empty."""
        self.connect()
        session = self.SessionLocal()
        try:
            # Check if settings exist (and create default if not)
            if not session.query(DBSetting).first():
                session.add(DBSetting(id=1))
                session.commit()

            # Check if drawings exist
            if session.query(Drawing).first():
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

            with open(seed_file, "r", encoding="utf-8") as f:
                drawings_data = json.load(f)

            for d in drawings_data:
                session.add(Drawing(label=d["label"], points=d["points"]))
            
            session.commit()
            print(f"Seeded {len(drawings_data)} drawings.")
        finally:
            session.close()
