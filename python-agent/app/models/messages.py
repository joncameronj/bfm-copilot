from pydantic import BaseModel
from typing import Literal


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class PatientContext(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    age: int | None = None
    gender: str | None = None
    chief_complaints: str | None = None
    medical_history: str | None = None
