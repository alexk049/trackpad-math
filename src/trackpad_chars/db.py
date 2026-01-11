import os
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
