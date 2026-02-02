"""
GenImagesPipeline - модули для оценки качества генеративных моделей изображений.
"""

from .validate_generation import validate_generation, laplacian_variance, edge_density

__all__ = [
    'validate_generation',
    'laplacian_variance', 
    'edge_density',
]
