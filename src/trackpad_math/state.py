from sqlalchemy.orm import Session
from typing import Annotated, Generator
from fastapi import Request, Depends
from pydantic import BaseModel, ConfigDict
from trackpad_math.db import Database
from trackpad_math.model import SymbolClassifier
from trackpad_math.socket_manager import ConnectionManager

class Settings(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    auto_mode: bool = True
    pause_threshold: int = 1000 # milliseconds
    equation_scroll_x_sensitivity: int = 20
    equation_scroll_y_sensitivity: int = 20

def get_db_session(request: Request) -> Generator:
    db: Database = request.app.state.db
    with db.session_scope() as session:
        yield session

def get_classifier(request: Request) -> SymbolClassifier:
    return request.app.state.classifier

def get_connection_manager(request: Request) -> ConnectionManager:
    return request.app.state.socket_manager

DBSession = Annotated[Session, Depends(get_db_session)]
ClassifierInstance = Annotated[SymbolClassifier, Depends(get_classifier)]
ConnectionManagerInstance = Annotated[ConnectionManager, Depends(get_connection_manager)]
