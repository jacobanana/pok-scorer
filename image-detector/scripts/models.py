"""
Pydantic models for POK detector parameters.
Handles validation and JSON serialization automatically.
"""

from typing import Literal, Any
from pydantic import BaseModel, Field, ConfigDict


class DetectorParams(BaseModel):
    """POK detector parameters - compatible with detector.js format"""

    # Algorithm (only 'hough' supported in Python)
    algorithm: Literal['hough'] = 'hough'

    # Hough Circle Detection parameters
    dp: float = Field(ge=1.0, le=2.5, description="Inverse ratio of accumulator resolution")
    minDist: int = Field(ge=10, le=80, description="Minimum distance between circle centers")
    param1: int = Field(ge=30, le=200, description="Canny edge threshold")
    param2: int = Field(ge=10, le=60, description="Accumulator threshold")
    minRadius: int = Field(ge=5, le=50, description="Minimum circle radius")
    maxRadius: int = Field(ge=20, le=100, description="Maximum circle radius")

    # Red color HSV parameters
    redH1Low: int = Field(ge=0, le=10, description="Red hue range 1 low")
    redH1High: int = Field(ge=5, le=20, description="Red hue range 1 high")
    redH2Low: int = Field(ge=150, le=175, description="Red hue range 2 low (wraps)")
    redH2High: int = Field(ge=170, le=180, description="Red hue range 2 high (wraps)")
    redSMin: int = Field(ge=50, le=180, description="Red saturation minimum")
    redVMin: int = Field(ge=50, le=180, description="Red value minimum")

    # Blue color HSV parameters
    blueH1Low: int = Field(ge=90, le=115, description="Blue hue range 1 low")
    blueH1High: int = Field(ge=115, le=140, description="Blue hue range 1 high")
    blueH2Low: int = Field(default=0, description="Blue hue range 2 low (unused)")
    blueH2High: int = Field(default=0, description="Blue hue range 2 high (unused)")
    blueSMin: int = Field(ge=50, le=180, description="Blue saturation minimum")
    blueVMin: int = Field(ge=50, le=180, description="Blue value minimum")

    class Config:
        # Generate JSON schema for documentation
        json_schema_extra = {
            "example": {
                "algorithm": "hough",
                "dp": 1.5,
                "minDist": 30,
                "param1": 100,
                "param2": 30,
                "minRadius": 10,
                "maxRadius": 50,
                "redH1Low": 0,
                "redH1High": 10,
                "redH2Low": 160,
                "redH2High": 180,
                "redSMin": 100,
                "redVMin": 100,
                "blueH1Low": 100,
                "blueH1High": 130,
                "blueH2Low": 0,
                "blueH2High": 0,
                "blueSMin": 100,
                "blueVMin": 100,
            }
        }


class TrainingMetadata(BaseModel):
    """Metadata about training run"""
    training_score: float
    validation_score: float
    dataset: str
    iterations: int
    train_images: int
    val_images: int
    param_source: str = Field(description="Which parameter set was selected (Optimizer Best, Hybrid, or Tracked Best)")


class DetectorParamsWithMetadata(DetectorParams):
    """Detector parameters with training metadata

    Python is the source of truth. This format is used by both Python and JavaScript.
    Format: {algorithm: 'hough', dp: 1.5, ..., _metadata: {...}}

    The metadata field is serialized as '_metadata' to indicate it should be
    ignored when applying parameters in detector.js.
    """

    model_config = ConfigDict(
        # Exclude None values from serialization
        exclude_none=True
    )

    # Training metadata (field name is 'metadata', serialized as '_metadata')
    metadata: TrainingMetadata | None = Field(
        default=None,
        serialization_alias='_metadata',
        description="Training run metadata (serialized as _metadata, ignored by detector.js)"
    )
