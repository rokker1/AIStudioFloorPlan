"""
Модуль валидации сгенерированных изображений.

Автоматическая проверка технической корректности и базового качества
изображений, созданных генеративными моделями.
"""

import cv2
import numpy as np
from PIL import Image
from typing import Tuple, Dict


def laplacian_variance(image: Image.Image) -> float:
    """
    Вычисляет дисперсию Лапласиана изображения для определения размытости.
    
    Высокое значение указывает на чёткое изображение,
    низкое — на размытое.
    
    Args:
        image: PIL Image объект
        
    Returns:
        Дисперсия Лапласиана
    """
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def edge_density(image: Image.Image) -> float:
    """
    Вычисляет плотность границ на изображении.
    
    Помогает определить, содержит ли изображение реальный контент
    или является пустым/однородным.
    
    Args:
        image: PIL Image объект
        
    Returns:
        Плотность границ (0-1)
    """
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    return edges.sum() / edges.size


def validate_generation(image: Image.Image) -> Tuple[bool, Dict[str, bool]]:
    """
    Автоматическая валидация сгенерированного изображения.
    
    Выполняет серию проверок для определения технической корректности
    и базового качества сгенерированного изображения.
    
    Args:
        image: PIL Image объект для проверки
        
    Returns:
        Tuple[bool, Dict[str, bool]]: 
            - bool: True если все проверки пройдены
            - Dict: Результаты отдельных проверок
            
    Example:
        >>> from PIL import Image
        >>> img = Image.open("generated_image.png")
        >>> is_valid, checks = validate_generation(img)
        >>> if not is_valid:
        ...     failed = [k for k, v in checks.items() if not v]
        ...     print(f"Не пройдены проверки: {failed}")
    """
    # Конвертируем в numpy array для расчётов
    img_array = np.array(image)
    
    checks = {
        # Техническая корректность
        'resolution': image.size[0] >= 1024 and image.size[1] >= 1024,
        'format': image.format == 'PNG' if image.format else True,
        'not_black': img_array.mean() > 10,
        'not_white': img_array.mean() < 245,
        'not_corrupted': _is_image_valid(image),
        
        # Базовое качество
        'not_blurry': laplacian_variance(image) > 100,
        'has_content': edge_density(image) > 0.1,
    }
    
    return all(checks.values()), checks


def _is_image_valid(image: Image.Image) -> bool:
    """
    Проверяет, не повреждено ли изображение.
    
    Args:
        image: PIL Image объект
        
    Returns:
        True если изображение валидно
    """
    try:
        image.verify()
        return True
    except Exception:
        return False


if __name__ == "__main__":
    # Пример использования
    import sys
    
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        img = Image.open(image_path)
        is_valid, checks = validate_generation(img)
        
        print(f"Изображение: {image_path}")
        print(f"Валидно: {is_valid}")
        print("\nДетали проверок:")
        for check_name, passed in checks.items():
            status = "✓" if passed else "✗"
            print(f"  {status} {check_name}")
    else:
        print("Использование: python validate_generation.py <путь_к_изображению>")
