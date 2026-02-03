# Методология оценки качества генеративных моделей изображений

## Регламент оценки Text-to-Image и Image-to-Image моделей

**Версия:** 2.0  
**Дата:** 2026-02-02  
**Статус:** Draft

---

## Содержание

1. [Введение и цели](#1-введение-и-цели)
2. [Терминология](#2-терминология)
3. [Таксономия доменов и задач](#3-таксономия-доменов-и-задач)
4. [Подготовка датасета](#4-подготовка-датасета)
5. [Методология экспертной оценки](#5-методология-экспертной-оценки)
6. [Машинные метрики](#6-машинные-метрики)
7. [Модель регрессии](#7-модель-регрессии)
8. [Валидация и контроль качества](#8-валидация-и-контроль-качества)
9. [Практическая реализация](#9-практическая-реализация)
10. [Приложения](#10-приложения)

---

## 1. Введение и цели

### 1.1 Проблематика

Современные бенчмарки оценки генеративных моделей (T2I-CompBench, GenEval) имеют существенные ограничения:

1. **Дефицит разнообразия промптов**: используются короткие шаблонные структуры типа "a photo of a [object] with [attribute]", не отражающие реальные пользовательские запросы.

2. **Несоответствие автоматических метрик человеческому восприятию**: CLIP Score не различает пространственные отношения ("мальчик под пчелой" vs "пчела под мальчиком") и не оценивает визуальное качество.

3. **Отсутствие специализации по доменам**: универсальные бенчмарки не учитывают специфику прикладных задач (образование, маркетинг, дизайн интерьеров).

### 1.2 Цели методологии

| Цель | Описание |
|------|----------|
| **Построение предиктивной модели** | Создание регрессионной модели, предсказывающей человеческие оценки по машинным метрикам |
| **Автоматизация оценки** | Возможность оценки новых моделей без привлечения экспертов |
| **Доменная специализация** | Учёт специфики различных прикладных областей |
| **Воспроизводимость** | Стандартизированная методология для сравнения моделей |

### 1.3 Общая схема пайплайна

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EVALUATION PIPELINE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐                │
│  │ 1. Dataset   │───▶│ 2. Image        │───▶│ 3. ML Metrics    │                │
│  │ Preparation  │    │ Generation      │    │ Computation      │                │
│  └──────────────┘    └─────────────────┘    └────────┬─────────┘                │
│         │                                             │                          │
│         │            ┌─────────────────┐              │                          │
│         └───────────▶│ 4. Human        │◀─────────────┘                          │
│                      │ Annotation      │                                         │
│                      └────────┬────────┘                                         │
│                               │                                                  │
│                               ▼                                                  │
│  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐                │
│  │ 7. Model     │◀───│ 6. Regression   │◀───│ 5. Data          │                │
│  │ Inference    │    │ Training        │    │ Aggregation      │                │
│  └──────────────┘    └─────────────────┘    └──────────────────┘                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Терминология

### 2.1 Базовые понятия

| Термин | Определение |
|--------|-------------|
| **Text-to-Image (T2I)** | Генерация изображения по текстовому описанию |
| **Image-to-Image (I2I)** | Трансформация исходного изображения согласно инструкции |
| **Промпт (Prompt)** | Текстовая инструкция для генерации/редактирования |
| **Домен (Domain)** | Предметная область применения (образование, маркетинг и т.д.) |
| **Задача (Task)** | Тип операции над изображением (генерация, inpainting, style transfer) |

### 2.2 Метрики качества

| Термин | Определение |
|--------|-------------|
| **Fidelity (Качество)** | Визуальное качество изображения: реалистичность, отсутствие артефактов, детализация |
| **Alignment (Соответствие)** | Степень соответствия результата текстовой инструкции |
| **Consistency (Согласованность)** | Сохранение стиля, идентичности объектов и важных деталей при редактировании |
| **Inter-Annotator Agreement (IAA)** | Степень согласованности оценок между экспертами |

### 2.3 Машинные метрики

| Метрика | Описание | Применение |
|---------|----------|------------|
| **CLIP Score** | Косинусное сходство эмбеддингов текста и изображения | Alignment |
| **DINO v2 Score** | Сходство визуальных эмбеддингов | Consistency (I2I) |
| **SSAE** | Structured Semantic Alignment Evaluation через VLM | Alignment |
| **FID/KID** | Fréchet/Kernel Inception Distance | Fidelity (распределение) |
| **Aesthetic Score** | Предсказание эстетической привлекательности | Fidelity |
| **LPIPS** | Learned Perceptual Image Patch Similarity | Consistency (I2I) |

---

## 3. Таксономия доменов и задач

### 3.1 Матрица "Домен × Задача"

Каждая ячейка матрицы представляет уникальную комбинацию предметной области и типа задачи, требующую отдельной выборки для оценки.

#### 3.1.1 Домены (предметные области)

| ID | Домен | Описание | Примеры промптов |
|----|-------|----------|------------------|
| D1 | **Образование** | Учебные материалы, иллюстрации, схемы | "Схема строения клетки", "Исторические события" |
| D2 | **Маркетинг** | Рекламные материалы, баннеры, продуктовые фото | "Рекламный баннер для кофейни" |
| D3 | **Дизайн интерьеров** | Визуализация помещений, мебель | "Современная гостиная в стиле минимализм" |
| D4 | **Архитектура** | Здания, планировки, экстерьеры | "Фасад офисного здания" |
| D5 | **Мода** | Одежда, аксессуары, модели | "Летнее платье в цветочный принт" |
| D6 | **Игровой контент** | Персонажи, окружения, ассеты | "Фэнтези-воин в доспехах" |
| D7 | **Фотореализм** | Реалистичные фотографии | "Портрет пожилого мужчины" |
| D8 | **Художественные стили** | Картины, иллюстрации в различных стилях | "Пейзаж в стиле импрессионизма" |

#### 3.1.2 Задачи (типы операций)

| ID | Задача | Тип | Описание |
|----|--------|-----|----------|
| T1 | **Text-to-Image Generation** | T2I | Генерация изображения с нуля по текстовому описанию |
| T2 | **Inpainting** | I2I | Заполнение выделенной области согласно инструкции |
| T3 | **Outpainting** | I2I | Расширение изображения за границы кадра |
| T4 | **Style Transfer** | I2I | Перенос художественного стиля с сохранением содержания |
| T5 | **Object Replacement** | I2I | Замена объекта на изображении |
| T6 | **Background Replacement** | I2I | Замена фона с сохранением переднего плана |
| T7 | **Image Enhancement** | I2I | Улучшение качества, увеличение разрешения |
| T8 | **Controlled Generation** | T2I | Генерация с дополнительными условиями (ControlNet, IP-Adapter) |

#### 3.1.3 Матрица применимости

```
              │ T1  │ T2  │ T3  │ T4  │ T5  │ T6  │ T7  │ T8  │
──────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
D1 Образование│  ✓  │  ✓  │  -  │  -  │  ✓  │  ✓  │  ✓  │  ✓  │
D2 Маркетинг  │  ✓  │  ✓  │  ✓  │  -  │  ✓  │  ✓  │  ✓  │  ✓  │
D3 Интерьеры  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │
D4 Архитектура│  ✓  │  ✓  │  ✓  │  ✓  │  -  │  ✓  │  ✓  │  ✓  │
D5 Мода       │  ✓  │  ✓  │  -  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │
D6 Игры       │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │  ✓  │
D7 Фотореализм│  ✓  │  ✓  │  ✓  │  -  │  ✓  │  ✓  │  ✓  │  ✓  │
D8 Арт-стили  │  ✓  │  -  │  -  │  ✓  │  -  │  -  │  ✓  │  ✓  │
```

**Легенда:** ✓ — комбинация релевантна, - — комбинация не применима или редка

### 3.2 Требования к размеру выборки

| Уровень | Сэмплов на ячейку | Всего (при 40 ячейках) | Назначение |
|---------|-------------------|------------------------|------------|
| Минимальный | 50 | 2000 | Пилотное исследование |
| Рекомендуемый | 100 | 4000 | Базовая оценка |
| Оптимальный | 150 | 6000 | Статистически значимые результаты |

---

## 4. Подготовка датасета

### 4.1 Структура данных

#### 4.1.1 Схема сэмпла

```json
{
  "sample_id": "uuid-v4",
  "domain": "D3",
  "task": "T1",
  "created_at": "2026-02-02T12:00:00Z",
  
  "input": {
    "prompt": "Современная гостиная в стиле минимализм с большими окнами",
    "negative_prompt": "низкое качество, размыто",
    "source_image": null,
    "mask_image": null,
    "reference_images": [],
    "control_images": []
  },
  
  "generation_params": {
    "model_name": "model-v1.0",
    "model_version": "1.0.0",
    "seed": 42,
    "steps": 30,
    "cfg_scale": 7.5,
    "sampler": "DPM++ 2M Karras",
    "width": 1024,
    "height": 1024
  },
  
  "output": {
    "generated_image": "path/to/image.png",
    "generation_time_ms": 3500
  },
  
  "metadata": {
    "prompt_complexity": "medium",
    "prompt_language": "ru",
    "expected_objects": ["гостиная", "окна", "минимализм"],
    "tags": ["interior", "modern", "minimalism"]
  }
}
```

#### 4.1.2 Дополнительные поля для I2I задач

```json
{
  "input": {
    "source_image": "path/to/source.png",
    "mask_image": "path/to/mask.png",
    "instruction": "Замени диван на кресло"
  },
  
  "i2i_metadata": {
    "edit_type": "object_replacement",
    "edit_region": {"x": 100, "y": 200, "w": 300, "h": 200},
    "preserve_elements": ["стены", "пол", "освещение"],
    "change_elements": ["диван"]
  }
}
```

### 4.2 Требования к промптам

#### 4.2.1 Уровни сложности промптов

| Уровень | Описание | Пример | Доля в выборке |
|---------|----------|--------|----------------|
| **Simple** | 1-2 объекта, базовые атрибуты | "Красная роза на белом фоне" | 20% |
| **Medium** | 3-5 объектов, пространственные отношения | "Кот сидит на подоконнике, за окном идёт дождь" | 50% |
| **Complex** | 6+ объектов, сложная композиция, стиль | "Средневековый замок на скале, закат, туман, птицы в небе, в стиле романтизма" | 30% |

#### 4.2.2 Структура промпта (рекомендуемая)

```
[Основной объект] + [Атрибуты] + [Действие/Состояние] + 
[Окружение] + [Освещение] + [Стиль] + [Технические параметры]
```

**Пример разбора:**
```
"Молодая женщина с рыжими волосами (основной объект + атрибут)
читает книгу (действие)
в уютном кафе (окружение)
тёплое вечернее освещение (освещение)
кинематографичный стиль (стиль)
высокая детализация, 8K (технические параметры)"
```

#### 4.2.3 Критерии качества промптов

| Критерий | Описание | Проверка |
|----------|----------|----------|
| **Однозначность** | Промпт не допускает множественных интерпретаций | Ручная проверка |
| **Полнота** | Все важные элементы явно описаны | Чеклист элементов |
| **Реализуемость** | Описанная сцена физически возможна | Ручная проверка |
| **Отсутствие противоречий** | Атрибуты не конфликтуют друг с другом | Автоматическая проверка |

### 4.3 Процедура сбора промптов

#### 4.3.1 Источники промптов

1. **Синтетическая генерация** (40%)
   - LLM-генерация по шаблонам
   - Комбинаторное расширение базовых промптов
   
2. **Реальные пользовательские запросы** (40%)
   - Логи production-систем (анонимизированные)
   - Публичные датасеты (DiffusionDB, LAION-Aesthetics)
   
3. **Экспертные промпты** (20%)
   - Составлены специалистами по каждому домену
   - Покрывают edge cases и сложные сценарии

#### 4.3.2 Процедура валидации промптов

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 1. Сбор         │────▶│ 2. Автоматическая│────▶│ 3. Ручная       │
│ промптов        │     │ фильтрация      │     │ проверка        │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │ 4. Финальный    │◀─────────────┘
                        │ датасет         │
                        └─────────────────┘
```

**Автоматические фильтры:**
- Длина промпта: 10-500 символов
- Язык: определённый (ru/en)
- Отсутствие запрещённого контента
- Синтаксическая корректность

**Ручная проверка:**
- Соответствие домену
- Адекватность сложности
- Отсутствие двусмысленности

### 4.4 Процедура генерации изображений

#### 4.4.1 Требования к генерации

| Параметр | Требование | Обоснование |
|----------|------------|-------------|
| **Фиксированные seeds** | Сохранять seed для воспроизводимости | Возможность повторной генерации |
| **Единые параметры** | Одинаковые steps, cfg_scale для всей выборки | Справедливое сравнение |
| **Разрешение** | Минимум 1024×1024 | Достаточная детализация |
| **Формат** | PNG без сжатия | Сохранение качества |

#### 4.4.2 Контроль качества генерации

```python
def validate_generation(sample):
    """Автоматическая валидация сгенерированного изображения"""
    
    checks = {
        # Техническая корректность
        'resolution': image.size >= (1024, 1024),
        'format': image.format == 'PNG',
        'not_black': image.mean() > 10,
        'not_white': image.mean() < 245,
        'not_corrupted': image.is_valid(),
        
        # Базовое качество
        'not_blurry': laplacian_variance(image) > 100,
        'has_content': edge_density(image) > 0.1,
    }
    
    return all(checks.values()), checks
```

---

## 5. Методология экспертной оценки

### 5.1 Критерии оценки

#### 5.1.1 Fidelity (Качество изображения)

**Определение:** Визуальное качество сгенерированного изображения независимо от соответствия промпту.

**Шкала оценки (1-10):**

| Балл | Описание |
|------|----------|
| 1-2 | Изображение непригодно: грубые артефакты, нечитаемое содержание |
| 3-4 | Множественные заметные дефекты: искажения лиц/рук, размытие, шум |
| 5-6 | Присутствуют некоторые артефакты, но изображение в целом приемлемо |
| 7-8 | Высокое качество с минимальными недостатками |
| 9-10 | Превосходное качество, неотличимо от профессионального контента |

**Что оценивается:**
- Отсутствие визуальных артефактов
- Корректность анатомии (лица, руки, тела)
- Чёткость и детализация
- Естественность цветов и освещения
- Отсутствие шума и размытия

**Что НЕ оценивается:**
- Соответствие промпту (это Alignment)
- Эстетическая привлекательность субъективная
- Художественная ценность

#### 5.1.2 Alignment (Соответствие инструкции)

**Определение:** Степень соответствия сгенерированного изображения текстовой инструкции.

**Шкала оценки (1-10):**

| Балл | Описание |
|------|----------|
| 1-2 | Изображение не соответствует промпту, отсутствуют ключевые элементы |
| 3-4 | Присутствует менее 50% запрошенных элементов |
| 5-6 | Основные элементы присутствуют, но есть существенные расхождения |
| 7-8 | Большинство элементов соответствует, незначительные расхождения |
| 9-10 | Полное соответствие всем элементам промпта |

**Методика оценки:**
1. Выделить ключевые элементы промпта (объекты, атрибуты, действия, отношения)
2. Проверить наличие каждого элемента
3. Оценить корректность атрибутов (цвет, размер, количество)
4. Проверить пространственные отношения

**Пример:**
```
Промпт: "Рыжий кот сидит на синем диване"

Ключевые элементы:
□ Кот — присутствует? цвет рыжий?
□ Диван — присутствует? цвет синий?
□ Отношение — кот НА диване (не рядом, не под)?
```

#### 5.1.3 Consistency (Согласованность) — только для I2I

**Определение:** Степень сохранения нерелевантных изменению аспектов исходного изображения.

**Шкала оценки (1-10):**

| Балл | Описание |
|------|----------|
| 1-2 | Исходное изображение полностью изменено, идентичность потеряна |
| 3-4 | Значительные изменения в областях, которые не должны были меняться |
| 5-6 | Заметные изменения стиля/деталей вне зоны редактирования |
| 7-8 | Минимальные изменения, идентичность сохранена |
| 9-10 | Изменения только в целевой области, остальное идентично |

**Что оценивается:**
- Сохранение идентичности объектов (лица, предметы)
- Сохранение стиля и цветовой палитры
- Сохранение освещения и перспективы
- Отсутствие артефактов на границах редактирования

### 5.2 Организация процесса аннотации

#### 5.2.1 Требования к экспертам

| Критерий | Требование |
|----------|------------|
| **Количество** | Минимум 3 эксперта на каждый сэмпл |
| **Квалификация** | Опыт работы с генеративными моделями |
| **Обучение** | Прохождение калибровочной сессии |
| **Качество** | Accuracy на gold samples > 70% |

#### 5.2.2 Процедура аннотации

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANNOTATION WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ОБУЧЕНИЕ                                                    │
│     ├── Изучение критериев оценки                              │
│     ├── Разбор примеров (хорошие/плохие)                       │
│     └── Калибровочная сессия (20 gold samples)                 │
│                                                                 │
│  2. АННОТАЦИЯ                                                   │
│     ├── Случайный порядок изображений                          │
│     ├── Независимая оценка (эксперт не видит чужих оценок)     │
│     ├── Регулярные gold samples (5% от объёма)                 │
│     └── Перерывы каждые 50 изображений                         │
│                                                                 │
│  3. КОНТРОЛЬ КАЧЕСТВА                                          │
│     ├── Проверка accuracy на gold samples                      │
│     ├── Анализ outliers                                        │
│     └── Пересмотр спорных случаев                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2.3 Интерфейс аннотации

**Минимальные требования к интерфейсу:**

1. **Отображение контекста:**
   - Промпт (текстовая инструкция)
   - Исходное изображение (для I2I)
   - Маска редактирования (если применимо)
   - Сгенерированное изображение

2. **Элементы оценки:**
   - Слайдеры 1-10 для каждого критерия
   - Возможность зума изображения
   - Опциональное текстовое поле для комментариев

3. **Навигация:**
   - Кнопки "Назад"/"Вперёд"
   - Прогресс-бар
   - Возможность пропустить (с обоснованием)

#### 5.2.4 Gold Samples (эталонные примеры)

**Назначение:** Контроль качества аннотации и калибровка экспертов.

**Требования:**
- 50-100 сэмплов с консенсусными оценками (3+ экспертов согласны)
- Покрытие всего диапазона оценок (1-10)
- Представленность всех доменов и задач

**Использование:**
```python
def check_expert_quality(expert_id, gold_samples):
    """Проверка качества эксперта на gold samples"""
    
    expert_ratings = get_ratings(expert_id, gold_samples)
    gold_ratings = get_gold_ratings(gold_samples)
    
    metrics = {
        'mae': mean_absolute_error(expert_ratings, gold_ratings),
        'correlation': pearsonr(expert_ratings, gold_ratings)[0],
        'within_2_points': (abs(expert_ratings - gold_ratings) <= 2).mean()
    }
    
    # Критерии качества
    is_qualified = (
        metrics['mae'] < 2.0 and
        metrics['correlation'] > 0.7 and
        metrics['within_2_points'] > 0.8
    )
    
    return is_qualified, metrics
```

### 5.3 Агрегация оценок

#### 5.3.1 Базовая агрегация

```python
def aggregate_ratings(sample_id: str, ratings: List[Rating]) -> AggregatedRating:
    """
    Агрегация оценок нескольких экспертов
    """
    # Фильтрация outliers
    filtered_ratings = remove_outliers(ratings, method='iqr')
    
    result = AggregatedRating(
        sample_id=sample_id,
        n_experts=len(filtered_ratings),
        
        # Средние значения
        fidelity_mean=np.mean([r.fidelity for r in filtered_ratings]),
        alignment_mean=np.mean([r.alignment for r in filtered_ratings]),
        consistency_mean=np.mean([r.consistency for r in filtered_ratings]),
        
        # Стандартные отклонения (uncertainty)
        fidelity_std=np.std([r.fidelity for r in filtered_ratings]),
        alignment_std=np.std([r.alignment for r in filtered_ratings]),
        consistency_std=np.std([r.consistency for r in filtered_ratings]),
        
        # Медианы (робастная оценка)
        fidelity_median=np.median([r.fidelity for r in filtered_ratings]),
        alignment_median=np.median([r.alignment for r in filtered_ratings]),
        consistency_median=np.median([r.consistency for r in filtered_ratings]),
    )
    
    return result
```

#### 5.3.2 Inter-Annotator Agreement (IAA)

```python
def calculate_iaa(ratings: List[List[float]]) -> Dict[str, float]:
    """
    Расчёт согласованности между аннотаторами
    
    Args:
        ratings: Матрица [n_samples x n_annotators]
    
    Returns:
        Метрики согласованности
    """
    from krippendorff import alpha
    from scipy.stats import spearmanr
    
    # Krippendorff's Alpha — основная метрика IAA
    # Интерпретация:
    #   α > 0.8 — отличная согласованность
    #   0.67 < α < 0.8 — хорошая согласованность
    #   α < 0.67 — требуется пересмотр критериев
    
    kripp_alpha = alpha(
        reliability_data=np.array(ratings).T,
        level_of_measurement='interval'
    )
    
    # ICC (Intraclass Correlation Coefficient)
    # Для интервальных данных, оценка надёжности
    icc = calculate_icc(ratings, icc_type='ICC(2,k)')
    
    # Средняя попарная корреляция
    pairwise_corrs = []
    n_annotators = len(ratings[0])
    for i in range(n_annotators):
        for j in range(i + 1, n_annotators):
            corr, _ = spearmanr(
                [r[i] for r in ratings],
                [r[j] for r in ratings]
            )
            pairwise_corrs.append(corr)
    
    return {
        'krippendorff_alpha': kripp_alpha,
        'icc': icc,
        'mean_pairwise_correlation': np.mean(pairwise_corrs),
        'min_pairwise_correlation': np.min(pairwise_corrs),
    }
```

#### 5.3.3 Обработка разногласий

| Уровень разногласия | Критерий | Действие |
|---------------------|----------|----------|
| **Низкий** | std ≤ 1.5 | Использовать среднее |
| **Средний** | 1.5 < std ≤ 2.5 | Использовать медиану |
| **Высокий** | std > 2.5 | Направить на пересмотр |

```python
def handle_disagreement(ratings: List[Rating], threshold: float = 2.5):
    """Обработка случаев сильного разногласия"""
    
    std = np.std([r.value for r in ratings])
    
    if std > threshold:
        # Направить на пересмотр
        return ReviewRequest(
            sample_id=ratings[0].sample_id,
            original_ratings=ratings,
            reason='high_disagreement',
            std=std
        )
    
    return None
```

---

## 6. Машинные метрики

### 6.1 Обзор метрик

#### 6.1.1 Классификация по назначению

```
┌─────────────────────────────────────────────────────────────────┐
│                    ML METRICS TAXONOMY                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ALIGNMENT (соответствие промпту)                              │
│  ├── CLIP Score (text-image similarity)                        │
│  ├── BLIP Score (image captioning similarity)                  │
│  └── SSAE (VLM-based structured evaluation)                    │
│                                                                 │
│  FIDELITY (качество изображения)                               │
│  ├── FID (Fréchet Inception Distance)                          │
│  ├── KID (Kernel Inception Distance)                           │
│  ├── Aesthetic Score (LAION predictor)                         │
│  └── Artifact Detection Score                                  │
│                                                                 │
│  CONSISTENCY (для I2I задач)                                   │
│  ├── DINO v2 Similarity                                        │
│  ├── LPIPS (perceptual similarity)                             │
│  ├── SSIM (structural similarity)                              │
│  └── Identity Preservation Score (для лиц)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.1.2 Сводная таблица всех метрик

| № | Метрика | Категория | Тип задачи | Шкала | Лучше | Single-image |
|---|---------|-----------|------------|-------|-------|--------------|
| 1 | **CLIP Score** | Alignment | T2I, I2I | 0-100 | Больше | ✓ |
| 2 | **BLIP Score** | Alignment | T2I, I2I | 0-1 | Больше | ✓ |
| 3 | **SSAE** | Alignment | T2I, I2I | 0-1 | Больше | ✓ |
| 4 | **FID** | Fidelity | T2I, I2I | 0-∞ | Меньше | ✗ (batch) |
| 5 | **KID** | Fidelity | T2I, I2I | 0-∞ | Меньше | ✗ (batch) |
| 6 | **Aesthetic Score** | Fidelity | T2I, I2I | 1-10 | Больше | ✓ |
| 7 | **Artifact Detection** | Fidelity | T2I, I2I | 0-1 | Больше | ✓ |
| 8 | **DINO v2 Similarity** | Consistency | I2I | 0-1 | Больше | ✓ (пара) |
| 9 | **LPIPS** | Consistency | I2I | 0-1 | Меньше | ✓ (пара) |
| 10 | **SSIM** | Consistency | I2I | 0-1 | Больше | ✓ (пара) |
| 11 | **Identity Preservation** | Consistency | I2I (лица) | 0-1 | Больше | ✓ (пара) |

**Примечания:**
- **Single-image** — метрика может быть рассчитана для одного изображения
- **✓ (пара)** — требуется пара изображений (source + generated)
- **✗ (batch)** — требуется набор изображений для расчёта статистик

#### 6.1.3 Рекомендуемый набор метрик по типу задачи

**Для Text-to-Image (T2I):**
```
Обязательные:
  ├── CLIP Score
  ├── SSAE (или BLIP Score)
  ├── Aesthetic Score
  └── Artifact Detection Score

Опциональные (batch-level):
  ├── FID
  └── KID
```

**Для Image-to-Image (I2I):**
```
Обязательные:
  ├── CLIP Score (для alignment к инструкции)
  ├── Aesthetic Score
  ├── Artifact Detection Score
  ├── DINO v2 Similarity
  ├── LPIPS
  └── SSIM

Опциональные:
  ├── SSAE (для сложных инструкций)
  ├── Identity Preservation (если есть лица)
  └── FID/KID (batch-level)
```

### 6.2 Детальное описание метрик

#### 6.2.1 CLIP Score

**Назначение:** Оценка семантического соответствия изображения тексту.

**Принцип работы:**
```python
def calculate_clip_score(image: Image, text: str) -> float:
    """
    Косинусное сходство между CLIP-эмбеддингами
    текста и изображения
    """
    import clip
    
    model, preprocess = clip.load("ViT-L/14")
    
    # Encode image
    image_input = preprocess(image).unsqueeze(0)
    image_features = model.encode_image(image_input)
    image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    
    # Encode text
    text_input = clip.tokenize([text])
    text_features = model.encode_text(text_input)
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)
    
    # Cosine similarity
    similarity = (image_features @ text_features.T).item()
    
    # Scale to 0-100
    return similarity * 100
```

**Ограничения:**
- Не различает пространственные отношения ("кот на столе" vs "стол на коте")
- Не оценивает визуальное качество
- Чувствителен к формулировке промпта

**Рекомендуемое использование:**
- Как один из входов для регрессии
- В комбинации с SSAE для более точной оценки alignment

#### 6.2.2 SSAE (Structured Semantic Alignment Evaluation)

**Назначение:** Детальная оценка соответствия через VLM с chain-of-thought.

**Принцип работы:**

```python
def calculate_ssae(image: Image, prompt: str, vlm_client) -> SSAEResult:
    """
    Structured Semantic Alignment Evaluation
    
    1. Извлечение ключевых точек из промпта
    2. Проверка каждой точки через VLM
    3. Агрегация результатов
    """
    
    # Step 1: Extract key points
    key_points = extract_key_points(prompt, vlm_client)
    # Returns: [
    #   {"category": "primary_subject", "point": "рыжий кот"},
    #   {"category": "action", "point": "сидит"},
    #   {"category": "location", "point": "на синем диване"},
    #   ...
    # ]
    
    # Step 2: Evaluate each key point
    evaluations = []
    for kp in key_points:
        eval_prompt = f"""
        Изображение приложено. Промпт: "{prompt}"
        
        Проверь наличие элемента: "{kp['point']}"
        
        Рассуждай пошагово:
        1. Что ты видишь на изображении?
        2. Присутствует ли указанный элемент?
        3. Если да, соответствует ли он описанию?
        
        Ответь в формате JSON:
        {{"reasoning": "...", "present": true/false, "correct": true/false}}
        """
        
        result = vlm_client.evaluate(image, eval_prompt)
        evaluations.append({
            'key_point': kp,
            'result': result
        })
    
    # Step 3: Aggregate
    scores_by_category = defaultdict(list)
    for ev in evaluations:
        category = ev['key_point']['category']
        score = 1 if (ev['result']['present'] and ev['result']['correct']) else 0
        scores_by_category[category].append(score)
    
    return SSAEResult(
        overall_score=np.mean([s for scores in scores_by_category.values() for s in scores]),
        category_scores={cat: np.mean(scores) for cat, scores in scores_by_category.items()},
        detailed_evaluations=evaluations
    )
```

**Категории ключевых точек (12 полей):**

| Категория | Описание | Пример |
|-----------|----------|--------|
| primary_noun | Главный объект | "кот" |
| primary_main_attr | Основные атрибуты главного объекта | "рыжий" |
| primary_action | Действие главного объекта | "сидит" |
| primary_other_attr | Дополнительные атрибуты | "пушистый" |
| secondary_noun | Второстепенные объекты | "диван" |
| secondary_attr | Атрибуты второстепенных объектов | "синий" |
| secondary_action | Действия второстепенных объектов | — |
| scene_noun | Объекты сцены | "комната" |
| scene_attr | Атрибуты сцены | "уютная" |
| camera_shot | Тип кадра | "крупный план" |
| style | Стиль | "фотореалистичный" |
| composition | Композиция | "центральная" |

#### 6.2.3 DINO v2 Similarity

**Назначение:** Оценка визуального сходства для I2I задач.

```python
def calculate_dino_similarity(
    source_image: Image, 
    generated_image: Image,
    mask: Optional[Image] = None
) -> float:
    """
    Косинусное сходство DINO v2 эмбеддингов
    
    Для задач редактирования оценивает сохранение
    идентичности вне зоны редактирования
    """
    import torch
    from transformers import AutoModel, AutoProcessor
    
    model = AutoModel.from_pretrained('facebook/dinov2-large')
    processor = AutoProcessor.from_pretrained('facebook/dinov2-large')
    
    def get_embedding(image):
        inputs = processor(images=image, return_tensors="pt")
        outputs = model(**inputs)
        return outputs.last_hidden_state.mean(dim=1)  # Global average pooling
    
    source_emb = get_embedding(source_image)
    generated_emb = get_embedding(generated_image)
    
    # Cosine similarity
    similarity = F.cosine_similarity(source_emb, generated_emb).item()
    
    return similarity
```

**Вариации для I2I:**
- **Global similarity:** Сходство всего изображения
- **Masked similarity:** Сходство только вне маски редактирования
- **Patch-level similarity:** Покомпонентное сравнение

#### 6.2.4 Aesthetic Score

**Назначение:** Предсказание эстетической привлекательности.

```python
def calculate_aesthetic_score(image: Image) -> float:
    """
    Aesthetic score based on LAION Aesthetic Predictor
    
    Обучен на LAION-Aesthetics dataset с человеческими оценками
    эстетичности изображений
    """
    from transformers import CLIPProcessor, CLIPModel
    import torch.nn as nn
    
    # Load CLIP + aesthetic head
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-large-patch14")
    aesthetic_head = load_aesthetic_head()  # Linear layer trained on LAION
    
    # Get CLIP image features
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-large-patch14")
    inputs = processor(images=image, return_tensors="pt")
    image_features = clip_model.get_image_features(**inputs)
    
    # Predict aesthetic score
    score = aesthetic_head(image_features).item()
    
    # Scale from raw score to 1-10
    return scale_to_1_10(score)
```

#### 6.2.5 FID (Fréchet Inception Distance)

**Назначение:** Оценка качества распределения сгенерированных изображений.

**Особенности:**
- Требует набора изображений (не single-image metric)
- Сравнивает распределение с reference dataset
- Меньше = лучше

```python
def calculate_fid(
    generated_images: List[Image],
    reference_images: List[Image]
) -> float:
    """
    FID между двумя наборами изображений
    
    Использует статистики (mean, cov) Inception features
    """
    from pytorch_fid import fid_score
    
    # Extract Inception features
    gen_features = extract_inception_features(generated_images)
    ref_features = extract_inception_features(reference_images)
    
    # Calculate statistics
    mu_gen, sigma_gen = np.mean(gen_features, axis=0), np.cov(gen_features, rowvar=False)
    mu_ref, sigma_ref = np.mean(ref_features, axis=0), np.cov(ref_features, rowvar=False)
    
    # Fréchet distance
    fid = calculate_frechet_distance(mu_gen, sigma_gen, mu_ref, sigma_ref)
    
    return fid
```

**Применение в нашем пайплайне:**
- Рассчитывается per-domain или per-task
- Reference: high-quality images из соответствующего домена

#### 6.2.6 BLIP Score

**Назначение:** Альтернативная оценка text-image alignment через image captioning.

**Принцип работы:** BLIP (Bootstrapped Language-Image Pre-training) генерирует caption для изображения, затем сравнивается семантическое сходство сгенерированного caption с исходным промптом.

**Преимущества над CLIP:**
- Лучше понимает сложные сцены и отношения между объектами
- Генерирует интерпретируемые описания
- Менее чувствителен к формулировке промпта

```python
def calculate_blip_score(image: Image, prompt: str) -> dict:
    """
    BLIP-based alignment score
    
    1. Генерирует caption для изображения
    2. Сравнивает caption с исходным промптом
    3. Возвращает similarity score и сгенерированный caption
    """
    from transformers import BlipProcessor, BlipForConditionalGeneration
    from sentence_transformers import SentenceTransformer
    
    # Load BLIP model
    processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
    blip_model = BlipForConditionalGeneration.from_pretrained(
        "Salesforce/blip-image-captioning-large"
    )
    
    # Generate caption
    inputs = processor(image, return_tensors="pt")
    caption_ids = blip_model.generate(**inputs, max_length=50)
    generated_caption = processor.decode(caption_ids[0], skip_special_tokens=True)
    
    # Calculate semantic similarity between prompt and generated caption
    sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
    
    prompt_embedding = sentence_model.encode(prompt)
    caption_embedding = sentence_model.encode(generated_caption)
    
    # Cosine similarity
    similarity = np.dot(prompt_embedding, caption_embedding) / (
        np.linalg.norm(prompt_embedding) * np.linalg.norm(caption_embedding)
    )
    
    return {
        'blip_score': float(similarity),
        'generated_caption': generated_caption,
        'prompt': prompt
    }
```

**Интерпретация:**
| Значение | Интерпретация |
|----------|---------------|
| > 0.8 | Отличное соответствие |
| 0.6 - 0.8 | Хорошее соответствие |
| 0.4 - 0.6 | Частичное соответствие |
| < 0.4 | Слабое соответствие |

#### 6.2.7 KID (Kernel Inception Distance)

**Назначение:** Оценка качества распределения генерации, альтернатива FID с лучшими статистическими свойствами.

**Отличия от FID:**
- Не требует предположения о нормальности распределения
- Более устойчив на малых выборках
- Имеет несмещённую оценку
- Меньше = лучше

**Математическое определение:**

```
KID = MMD²(P_real, P_gen)

где MMD (Maximum Mean Discrepancy):
MMD²(P, Q) = E[k(x, x')] + E[k(y, y')] - 2E[k(x, y)]

k — polynomial kernel: k(x, y) = (γ * x^T * y + c)^d
```

```python
def calculate_kid(
    generated_images: List[Image],
    reference_images: List[Image],
    subset_size: int = 100,
    num_subsets: int = 100
) -> dict:
    """
    Kernel Inception Distance
    
    Использует polynomial kernel на Inception features
    Возвращает mean ± std по нескольким подвыборкам
    """
    from scipy import linalg
    import torch
    from torchvision.models import inception_v3
    
    # Load Inception model
    inception = inception_v3(pretrained=True, transform_input=False)
    inception.fc = torch.nn.Identity()  # Remove classification layer
    inception.eval()
    
    def extract_features(images):
        """Extract Inception features for a batch of images"""
        features = []
        for img in images:
            img_tensor = preprocess_inception(img)
            with torch.no_grad():
                feat = inception(img_tensor.unsqueeze(0))
            features.append(feat.squeeze().numpy())
        return np.array(features)
    
    def polynomial_kernel(X, Y, degree=3, gamma=None, coef0=1):
        """Polynomial kernel k(x, y) = (γ * x^T * y + c)^d"""
        if gamma is None:
            gamma = 1.0 / X.shape[1]
        return (gamma * np.dot(X, Y.T) + coef0) ** degree
    
    def compute_kid_single(real_features, gen_features):
        """Compute KID for a single pair of feature sets"""
        n, m = len(real_features), len(gen_features)
        
        # Kernel matrices
        K_rr = polynomial_kernel(real_features, real_features)
        K_gg = polynomial_kernel(gen_features, gen_features)
        K_rg = polynomial_kernel(real_features, gen_features)
        
        # MMD² unbiased estimator
        # E[k(x,x')] - diagonal terms excluded
        term1 = (K_rr.sum() - np.trace(K_rr)) / (n * (n - 1))
        term2 = (K_gg.sum() - np.trace(K_gg)) / (m * (m - 1))
        term3 = K_rg.sum() / (n * m)
        
        mmd2 = term1 + term2 - 2 * term3
        return mmd2
    
    # Extract features
    real_features = extract_features(reference_images)
    gen_features = extract_features(generated_images)
    
    # Compute KID over multiple subsets
    kid_values = []
    for _ in range(num_subsets):
        # Random subsets
        real_subset = real_features[
            np.random.choice(len(real_features), subset_size, replace=False)
        ]
        gen_subset = gen_features[
            np.random.choice(len(gen_features), subset_size, replace=False)
        ]
        
        kid = compute_kid_single(real_subset, gen_subset)
        kid_values.append(kid)
    
    return {
        'kid_mean': float(np.mean(kid_values)),
        'kid_std': float(np.std(kid_values)),
        'num_real_images': len(reference_images),
        'num_gen_images': len(generated_images)
    }
```

**Рекомендуемые параметры:**
| Параметр | Значение | Описание |
|----------|----------|----------|
| subset_size | 100-1000 | Размер подвыборки |
| num_subsets | 100 | Количество подвыборок для оценки variance |
| degree | 3 | Степень polynomial kernel |

#### 6.2.8 Artifact Detection Score

**Назначение:** Автоматическое обнаружение типичных артефактов генеративных моделей.

**Типы детектируемых артефактов:**
- Искажения лиц и рук
- Размытие и шум
- Неестественные текстуры
- Артефакты на границах объектов
- Повторяющиеся паттерны
- Цветовые аномалии

```python
def calculate_artifact_score(image: Image) -> dict:
    """
    Комплексная оценка артефактов на изображении
    
    Комбинирует несколько детекторов:
    1. AI-generated image detector
    2. Face/hand anomaly detector  
    3. Texture anomaly detector
    4. Edge artifact detector
    
    Returns:
        score: 0-1, где 1 = нет артефактов
        details: детализация по типам артефактов
    """
    import cv2
    import torch
    from facenet_pytorch import MTCNN
    
    results = {}
    
    # 1. Laplacian variance (blur detection)
    gray = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    results['blur_score'] = min(1.0, laplacian_var / 500)  # Normalize
    
    # 2. Edge coherence (artifact at boundaries)
    edges = cv2.Canny(gray, 100, 200)
    edge_density = edges.sum() / edges.size
    # Too few or too many edges indicate problems
    results['edge_score'] = 1.0 - abs(edge_density - 0.1) / 0.1
    results['edge_score'] = max(0, min(1, results['edge_score']))
    
    # 3. Color histogram analysis (unnatural colors)
    img_array = np.array(image)
    color_scores = []
    for channel in range(3):
        hist = np.histogram(img_array[:,:,channel], bins=256, range=(0,256))[0]
        hist = hist / hist.sum()
        # Check for unusual peaks or gaps
        entropy = -np.sum(hist * np.log(hist + 1e-10))
        color_scores.append(min(1.0, entropy / 5.5))  # Max entropy ≈ 5.5
    results['color_score'] = np.mean(color_scores)
    
    # 4. Face detection and quality (if faces present)
    mtcnn = MTCNN(keep_all=True)
    boxes, probs = mtcnn.detect(image)
    
    if boxes is not None and len(boxes) > 0:
        # Check face detection confidence as proxy for face quality
        face_confidences = [p for p in probs if p is not None]
        if face_confidences:
            results['face_score'] = float(np.mean(face_confidences))
        else:
            results['face_score'] = 1.0  # No face issues detected
    else:
        results['face_score'] = 1.0  # No faces, no face artifacts
    
    # 5. Repetition pattern detection (tiling artifacts)
    def detect_repetition(img_gray, patch_size=32):
        """Detect repeating patterns via autocorrelation"""
        h, w = img_gray.shape
        if h < patch_size * 2 or w < patch_size * 2:
            return 1.0
        
        # Sample patches
        patches = []
        for _ in range(20):
            y = np.random.randint(0, h - patch_size)
            x = np.random.randint(0, w - patch_size)
            patches.append(img_gray[y:y+patch_size, x:x+patch_size].flatten())
        
        # Check similarity between patches
        patches = np.array(patches)
        similarity_matrix = np.corrcoef(patches)
        
        # High off-diagonal similarity indicates repetition
        off_diag = similarity_matrix[np.triu_indices(len(patches), k=1)]
        repetition_score = 1.0 - np.mean(np.abs(off_diag) > 0.8)
        
        return repetition_score
    
    results['repetition_score'] = detect_repetition(gray)
    
    # 6. AI-generated image detection (optional, requires trained model)
    # This would use a model like the one from "Detecting AI-Generated Images"
    # results['ai_detection_score'] = ai_detector.predict(image)
    
    # Aggregate scores
    weights = {
        'blur_score': 0.2,
        'edge_score': 0.15,
        'color_score': 0.15,
        'face_score': 0.3,
        'repetition_score': 0.2
    }
    
    overall_score = sum(
        results[k] * weights[k] 
        for k in weights.keys() 
        if k in results
    )
    
    return {
        'artifact_score': float(overall_score),
        'details': results,
        'interpretation': 'higher is better (fewer artifacts)'
    }
```

**Интерпретация результатов:**
| Балл | Качество | Описание |
|------|----------|----------|
| 0.9 - 1.0 | Отличное | Артефакты не обнаружены |
| 0.7 - 0.9 | Хорошее | Минимальные артефакты |
| 0.5 - 0.7 | Среднее | Заметные артефакты |
| < 0.5 | Плохое | Значительные артефакты |

#### 6.2.9 LPIPS (Learned Perceptual Image Patch Similarity)

**Назначение:** Оценка перцептуального сходства между изображениями, лучше коррелирует с человеческим восприятием чем MSE/PSNR.

**Принцип работы:** Сравнивает активации глубоких слоёв нейронной сети (VGG/AlexNet) между двумя изображениями.

**Применение:** I2I задачи — оценка consistency вне зоны редактирования.

**Особенности:**
- Меньше = лучше (более похожие изображения)
- Учитывает высокоуровневые признаки
- Инвариантен к небольшим пиксельным изменениям

```python
def calculate_lpips(
    source_image: Image,
    generated_image: Image,
    mask: Optional[Image] = None,
    net: str = 'alex'  # 'alex', 'vgg', 'squeeze'
) -> dict:
    """
    LPIPS (Learned Perceptual Image Patch Similarity)
    
    Меньше = более похожие изображения
    
    Args:
        source_image: Исходное изображение
        generated_image: Сгенерированное изображение
        mask: Маска области редактирования (optional)
               Если указана, считается LPIPS только вне маски
        net: Backbone network ('alex', 'vgg', 'squeeze')
    
    Returns:
        lpips_distance: Перцептуальное расстояние [0, 1]
    """
    import lpips
    import torch
    import torchvision.transforms as transforms
    
    # Initialize LPIPS model
    loss_fn = lpips.LPIPS(net=net)
    
    # Preprocessing
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
    ])
    
    img1 = transform(source_image).unsqueeze(0)
    img2 = transform(generated_image).unsqueeze(0)
    
    if mask is not None:
        # Apply inverse mask (evaluate only preserved regions)
        mask_tensor = transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.ToTensor()
        ])(mask).unsqueeze(0)
        
        # Invert mask: 1 = preserved regions, 0 = edited regions
        inverse_mask = 1 - mask_tensor
        
        # Apply mask to both images
        img1_masked = img1 * inverse_mask
        img2_masked = img2 * inverse_mask
        
        # Calculate LPIPS on masked images
        with torch.no_grad():
            distance = loss_fn(img1_masked, img2_masked)
    else:
        with torch.no_grad():
            distance = loss_fn(img1, img2)
    
    return {
        'lpips_distance': float(distance.item()),
        'backbone': net,
        'masked': mask is not None,
        'interpretation': 'lower is better (more similar)'
    }
```

**Референсные значения:**

| LPIPS | Интерпретация |
|-------|---------------|
| < 0.1 | Почти идентичные изображения |
| 0.1 - 0.3 | Очень похожие |
| 0.3 - 0.5 | Похожие с заметными различиями |
| > 0.5 | Существенно различаются |

#### 6.2.10 SSIM (Structural Similarity Index)

**Назначение:** Оценка структурного сходства изображений на основе яркости, контраста и структуры.

**Применение:** I2I задачи — оценка сохранения структуры вне зоны редактирования.

**Особенности:**
- Значения от -1 до 1, где 1 = идентичные изображения
- Больше = лучше
- Учитывает локальные паттерны
- Менее чувствителен к глобальным изменениям яркости

**Математическое определение:**

```
SSIM(x, y) = [l(x,y)]^α · [c(x,y)]^β · [s(x,y)]^γ

где:
- l(x,y) = (2μₓμᵧ + C₁) / (μₓ² + μᵧ² + C₁)     — luminance
- c(x,y) = (2σₓσᵧ + C₂) / (σₓ² + σᵧ² + C₂)     — contrast  
- s(x,y) = (σₓᵧ + C₃) / (σₓσᵧ + C₃)            — structure
```

```python
def calculate_ssim(
    source_image: Image,
    generated_image: Image,
    mask: Optional[Image] = None,
    window_size: int = 11,
    data_range: int = 255
) -> dict:
    """
    SSIM (Structural Similarity Index)
    
    Больше = более похожие изображения (max = 1.0)
    
    Args:
        source_image: Исходное изображение
        generated_image: Сгенерированное изображение
        mask: Маска области редактирования (optional)
        window_size: Размер окна для локальных статистик
        data_range: Диапазон значений пикселей
    
    Returns:
        ssim_score: Структурное сходство [0, 1]
        ssim_map: Карта локальных SSIM значений
    """
    from skimage.metrics import structural_similarity as ssim
    import numpy as np
    
    # Convert to numpy arrays
    img1 = np.array(source_image)
    img2 = np.array(generated_image)
    
    # Ensure same size
    if img1.shape != img2.shape:
        from PIL import Image as PILImage
        img2_pil = PILImage.fromarray(img2)
        img2_pil = img2_pil.resize((img1.shape[1], img1.shape[0]))
        img2 = np.array(img2_pil)
    
    # Calculate SSIM
    if len(img1.shape) == 3:  # Color image
        ssim_value, ssim_map = ssim(
            img1, img2,
            win_size=window_size,
            data_range=data_range,
            channel_axis=2,
            full=True
        )
    else:  # Grayscale
        ssim_value, ssim_map = ssim(
            img1, img2,
            win_size=window_size,
            data_range=data_range,
            full=True
        )
    
    # Apply mask if provided (evaluate only preserved regions)
    if mask is not None:
        mask_array = np.array(mask.resize((img1.shape[1], img1.shape[0])))
        if len(mask_array.shape) == 3:
            mask_array = mask_array[:, :, 0]
        
        # Normalize mask to [0, 1]
        mask_array = mask_array / 255.0
        
        # Invert: 1 = preserved, 0 = edited
        inverse_mask = 1 - mask_array
        
        # Weighted SSIM (only preserved regions)
        if inverse_mask.sum() > 0:
            if len(ssim_map.shape) == 3:
                ssim_map_gray = ssim_map.mean(axis=2)
            else:
                ssim_map_gray = ssim_map
            
            masked_ssim = (ssim_map_gray * inverse_mask).sum() / inverse_mask.sum()
            ssim_value = masked_ssim
    
    # Additional metrics
    # MS-SSIM (Multi-Scale SSIM) for more robust comparison
    try:
        from pytorch_msssim import ms_ssim
        import torch
        
        img1_tensor = torch.from_numpy(img1).permute(2, 0, 1).unsqueeze(0).float()
        img2_tensor = torch.from_numpy(img2).permute(2, 0, 1).unsqueeze(0).float()
        
        ms_ssim_value = ms_ssim(img1_tensor, img2_tensor, data_range=255).item()
    except:
        ms_ssim_value = None
    
    return {
        'ssim_score': float(ssim_value),
        'ms_ssim_score': ms_ssim_value,
        'masked': mask is not None,
        'window_size': window_size,
        'interpretation': 'higher is better (more similar, max=1.0)'
    }
```

**Референсные значения:**

| SSIM | Интерпретация |
|------|---------------|
| > 0.95 | Почти идентичные |
| 0.85 - 0.95 | Очень похожие |
| 0.70 - 0.85 | Похожие |
| < 0.70 | Существенные различия |

#### 6.2.11 Identity Preservation Score

**Назначение:** Специализированная метрика для оценки сохранения идентичности лиц при редактировании изображений с людьми.

**Применение:** I2I задачи, где важно сохранить узнаваемость человека (например, смена фона, изменение одежды).

**Принцип работы:** Сравнение face embeddings из моделей распознавания лиц (ArcFace, FaceNet).

```python
def calculate_identity_preservation(
    source_image: Image,
    generated_image: Image,
    model_name: str = 'arcface'
) -> dict:
    """
    Identity Preservation Score для лиц
    
    Сравнивает face embeddings между исходным и сгенерированным изображением.
    
    Args:
        source_image: Исходное изображение с лицом
        generated_image: Сгенерированное изображение
        model_name: Модель для извлечения эмбеддингов ('arcface', 'facenet')
    
    Returns:
        identity_score: Косинусное сходство эмбеддингов лиц [0, 1]
        face_detected: Были ли обнаружены лица на обоих изображениях
    """
    import torch
    import numpy as np
    from facenet_pytorch import MTCNN, InceptionResnetV1
    from PIL import Image as PILImage
    
    # Initialize face detection and recognition models
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    
    # MTCNN for face detection and alignment
    mtcnn = MTCNN(
        image_size=160,
        margin=20,
        device=device,
        post_process=True
    )
    
    # Face recognition model
    if model_name == 'arcface':
        # Load ArcFace model
        from insightface.app import FaceAnalysis
        face_app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        
        def get_embedding(image):
            img_array = np.array(image)
            faces = face_app.get(img_array)
            if len(faces) == 0:
                return None
            # Return embedding of the largest face
            largest_face = max(faces, key=lambda x: x.bbox[2] * x.bbox[3])
            return largest_face.embedding
    else:
        # Use FaceNet (InceptionResnetV1)
        resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)
        
        def get_embedding(image):
            # Detect and align face
            face_tensor = mtcnn(image)
            if face_tensor is None:
                return None
            
            # Get embedding
            face_tensor = face_tensor.unsqueeze(0).to(device)
            with torch.no_grad():
                embedding = resnet(face_tensor)
            
            return embedding.cpu().numpy().flatten()
    
    # Get embeddings for both images
    source_embedding = get_embedding(source_image)
    generated_embedding = get_embedding(generated_image)
    
    # Handle cases where face is not detected
    if source_embedding is None:
        return {
            'identity_score': None,
            'face_detected_source': False,
            'face_detected_generated': generated_embedding is not None,
            'error': 'No face detected in source image'
        }
    
    if generated_embedding is None:
        return {
            'identity_score': 0.0,  # Face lost = worst case
            'face_detected_source': True,
            'face_detected_generated': False,
            'error': 'No face detected in generated image (identity lost)'
        }
    
    # Calculate cosine similarity
    source_norm = source_embedding / np.linalg.norm(source_embedding)
    generated_norm = generated_embedding / np.linalg.norm(generated_embedding)
    
    cosine_similarity = np.dot(source_norm, generated_norm)
    
    # Additional: L2 distance (for reference)
    l2_distance = np.linalg.norm(source_embedding - generated_embedding)
    
    return {
        'identity_score': float(cosine_similarity),
        'l2_distance': float(l2_distance),
        'face_detected_source': True,
        'face_detected_generated': True,
        'model': model_name,
        'interpretation': 'higher is better (same person, threshold ~0.5)'
    }
```

**Пороговые значения для идентификации:**

| Similarity | Интерпретация | Применение |
|------------|---------------|------------|
| > 0.7 | Точно тот же человек | Строгое сохранение идентичности |
| 0.5 - 0.7 | Вероятно тот же человек | Допустимое сохранение |
| 0.3 - 0.5 | Похожие черты | Частичное сохранение |
| < 0.3 | Разные люди | Идентичность потеряна |

**Важные замечания:**
- Метрика применима только для изображений с лицами
- Требует предварительного обнаружения лиц
- Чувствительна к ракурсу и освещению
- Рекомендуется использовать вместе с DINO v2 для комплексной оценки

### 6.3 Вычислительный пайплайн

#### 6.3.1 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                 ML METRICS COMPUTATION PIPELINE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                                               │
│  │ Input Queue  │──┐                                            │
│  │ (samples)    │  │                                            │
│  └──────────────┘  │                                            │
│                    │                                            │
│                    ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 PARALLEL COMPUTATION                     │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐   │   │
│  │  │  CLIP   │ │  DINO   │ │Aesthetic│ │    SSAE     │   │   │
│  │  │  Score  │ │  v2     │ │  Score  │ │   (VLM)     │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └──────┬──────┘   │   │
│  │       │           │           │             │           │   │
│  │       └───────────┴───────────┴─────────────┘           │   │
│  │                           │                              │   │
│  └───────────────────────────┼──────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                    ┌──────────────────┐                        │
│                    │   ML_Rates DB    │                        │
│                    │   (aggregated)   │                        │
│                    └──────────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.3.2 Код вычисления

```python
from dataclasses import dataclass
from typing import Optional
import asyncio

@dataclass
class MLMetricsResult:
    sample_id: str
    
    # Alignment metrics
    clip_score: float
    ssae_score: float
    ssae_category_scores: Dict[str, float]
    
    # Fidelity metrics
    aesthetic_score: float
    artifact_score: float
    
    # Consistency metrics (I2I only)
    dino_similarity: Optional[float]
    lpips_distance: Optional[float]
    ssim_score: Optional[float]
    
    # Metadata
    computation_time_ms: int
    model_versions: Dict[str, str]


async def compute_ml_metrics(sample: Sample) -> MLMetricsResult:
    """
    Параллельное вычисление всех ML метрик для сэмпла
    """
    start_time = time.time()
    
    image = load_image(sample.output.generated_image)
    prompt = sample.input.prompt
    
    # Parallel computation
    tasks = [
        compute_clip_score(image, prompt),
        compute_ssae(image, prompt),
        compute_aesthetic_score(image),
        compute_artifact_score(image),
    ]
    
    # Add I2I specific metrics
    if sample.input.source_image:
        source_image = load_image(sample.input.source_image)
        mask = load_image(sample.input.mask_image) if sample.input.mask_image else None
        
        tasks.extend([
            compute_dino_similarity(source_image, image, mask),
            compute_lpips(source_image, image),
            compute_ssim(source_image, image, mask),
        ])
    
    results = await asyncio.gather(*tasks)
    
    return MLMetricsResult(
        sample_id=sample.sample_id,
        clip_score=results[0],
        ssae_score=results[1]['overall'],
        ssae_category_scores=results[1]['categories'],
        aesthetic_score=results[2],
        artifact_score=results[3],
        dino_similarity=results[4] if len(results) > 4 else None,
        lpips_distance=results[5] if len(results) > 5 else None,
        ssim_score=results[6] if len(results) > 6 else None,
        computation_time_ms=int((time.time() - start_time) * 1000),
        model_versions=get_model_versions()
    )
```

---

## 7. Модель регрессии

### 7.1 Постановка задачи

**Цель:** Построить модель, предсказывающую человеческие оценки по ML метрикам.

**Формализация:**

```
Входы (X):
  x = [clip_score, ssae_score, aesthetic_score, artifact_score, 
       dino_similarity*, lpips_distance*, ssim_score*]
  
  * — только для I2I задач

Выходы (Y):
  y = [fidelity_pred, alignment_pred, consistency_pred*]
  
  * — только для I2I задач

Задача:
  Найти f: X → Y, минимизирующую:
  L = Σ w_i * MSE(f(x_i), y_i)
  
  где w_i — веса, обратно пропорциональные uncertainty (std оценок экспертов)
```

### 7.2 Архитектура модели

#### 7.2.1 Multi-Task Neural Network

```python
import torch
import torch.nn as nn

class HumanPreferencePredictor(nn.Module):
    """
    Multi-task модель для предсказания человеческих оценок
    
    Архитектура:
    - Shared layers для общих паттернов
    - Task-specific heads для каждой метрики
    - Uncertainty estimation
    """
    
    def __init__(
        self,
        n_ml_features: int = 7,
        hidden_dims: List[int] = [128, 64, 32],
        dropout: float = 0.2,
        predict_uncertainty: bool = True
    ):
        super().__init__()
        
        self.predict_uncertainty = predict_uncertainty
        
        # Shared encoder
        layers = []
        in_dim = n_ml_features
        for h_dim in hidden_dims:
            layers.extend([
                nn.Linear(in_dim, h_dim),
                nn.LayerNorm(h_dim),
                nn.ReLU(),
                nn.Dropout(dropout)
            ])
            in_dim = h_dim
        
        self.shared = nn.Sequential(*layers)
        
        # Task-specific heads
        # Каждая голова предсказывает mean и (опционально) std
        output_dim = 2 if predict_uncertainty else 1
        
        self.fidelity_head = nn.Linear(hidden_dims[-1], output_dim)
        self.alignment_head = nn.Linear(hidden_dims[-1], output_dim)
        self.consistency_head = nn.Linear(hidden_dims[-1], output_dim)
        
        # Feature importance (для интерпретируемости)
        self.feature_importance = nn.Parameter(torch.ones(n_ml_features))
        
    def forward(self, x: torch.Tensor, task_mask: Optional[torch.Tensor] = None):
        """
        Args:
            x: [batch_size, n_features] — ML метрики
            task_mask: [batch_size, 3] — маска активных задач (для I2I)
        
        Returns:
            predictions: Dict с предсказаниями для каждой метрики
        """
        # Apply feature importance weighting
        x_weighted = x * torch.softmax(self.feature_importance, dim=0)
        
        # Shared representation
        shared = self.shared(x_weighted)
        
        # Task-specific predictions
        fidelity_out = self.fidelity_head(shared)
        alignment_out = self.alignment_head(shared)
        consistency_out = self.consistency_head(shared)
        
        if self.predict_uncertainty:
            return {
                'fidelity': {
                    'mean': fidelity_out[:, 0],
                    'log_std': fidelity_out[:, 1]
                },
                'alignment': {
                    'mean': alignment_out[:, 0],
                    'log_std': alignment_out[:, 1]
                },
                'consistency': {
                    'mean': consistency_out[:, 0],
                    'log_std': consistency_out[:, 1]
                }
            }
        else:
            return {
                'fidelity': fidelity_out.squeeze(-1),
                'alignment': alignment_out.squeeze(-1),
                'consistency': consistency_out.squeeze(-1)
            }
    
    def get_feature_importance(self) -> Dict[str, float]:
        """Возвращает важность каждой входной фичи"""
        importance = torch.softmax(self.feature_importance, dim=0)
        feature_names = [
            'clip_score', 'ssae_score', 'aesthetic_score', 'artifact_score',
            'dino_similarity', 'lpips_distance', 'ssim_score'
        ]
        return dict(zip(feature_names, importance.detach().cpu().numpy()))
```

#### 7.2.2 Loss Function

```python
class UncertaintyWeightedLoss(nn.Module):
    """
    Loss с учётом uncertainty:
    1. Uncertainty от модели (heteroscedastic)
    2. Uncertainty от разброса экспертных оценок
    """
    
    def __init__(self, use_human_uncertainty: bool = True):
        super().__init__()
        self.use_human_uncertainty = use_human_uncertainty
    
    def forward(
        self,
        predictions: Dict[str, Dict[str, torch.Tensor]],
        targets: Dict[str, torch.Tensor],
        human_stds: Optional[Dict[str, torch.Tensor]] = None
    ) -> torch.Tensor:
        
        total_loss = 0.0
        
        for task in ['fidelity', 'alignment', 'consistency']:
            if task not in targets:
                continue
            
            pred_mean = predictions[task]['mean']
            pred_log_std = predictions[task]['log_std']
            target = targets[task]
            
            # Heteroscedastic loss (Gaussian NLL)
            # L = 0.5 * (log(σ²) + (y - μ)² / σ²)
            pred_std = torch.exp(pred_log_std)
            mse = (pred_mean - target) ** 2
            nll = 0.5 * (pred_log_std + mse / (pred_std ** 2 + 1e-6))
            
            # Weight by human uncertainty (inverse variance weighting)
            if self.use_human_uncertainty and human_stds is not None:
                human_std = human_stds[task]
                weights = 1.0 / (human_std ** 2 + 1e-6)
                weights = weights / weights.sum()  # Normalize
                task_loss = (weights * nll).sum()
            else:
                task_loss = nll.mean()
            
            total_loss += task_loss
        
        return total_loss
```

### 7.3 Процедура обучения

#### 7.3.1 Подготовка данных

```python
class RegressionDataset(torch.utils.data.Dataset):
    """Dataset для обучения регрессионной модели"""
    
    def __init__(
        self,
        ml_metrics: pd.DataFrame,
        human_ratings: pd.DataFrame,
        task_type: str = 'all'  # 'T2I', 'I2I', 'all'
    ):
        # Merge ML metrics with human ratings
        self.data = ml_metrics.merge(human_ratings, on='sample_id')
        
        # Filter by task type
        if task_type == 'T2I':
            self.data = self.data[self.data['task'].str.startswith('T1')]
        elif task_type == 'I2I':
            self.data = self.data[~self.data['task'].str.startswith('T1')]
        
        # Feature columns
        self.feature_cols = [
            'clip_score', 'ssae_score', 'aesthetic_score', 'artifact_score'
        ]
        if task_type in ['I2I', 'all']:
            self.feature_cols.extend(['dino_similarity', 'lpips_distance', 'ssim_score'])
        
        # Target columns
        self.target_cols = ['fidelity_mean', 'alignment_mean']
        self.std_cols = ['fidelity_std', 'alignment_std']
        
        if task_type in ['I2I', 'all']:
            self.target_cols.append('consistency_mean')
            self.std_cols.append('consistency_std')
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        row = self.data.iloc[idx]
        
        features = torch.tensor(
            [row[col] for col in self.feature_cols],
            dtype=torch.float32
        )
        
        targets = {
            'fidelity': torch.tensor(row['fidelity_mean'], dtype=torch.float32),
            'alignment': torch.tensor(row['alignment_mean'], dtype=torch.float32),
        }
        
        stds = {
            'fidelity': torch.tensor(row['fidelity_std'], dtype=torch.float32),
            'alignment': torch.tensor(row['alignment_std'], dtype=torch.float32),
        }
        
        if 'consistency_mean' in row:
            targets['consistency'] = torch.tensor(row['consistency_mean'], dtype=torch.float32)
            stds['consistency'] = torch.tensor(row['consistency_std'], dtype=torch.float32)
        
        return features, targets, stds
```

#### 7.3.2 Training Loop

```python
def train_regression_model(
    train_dataset: RegressionDataset,
    val_dataset: RegressionDataset,
    config: TrainingConfig
) -> Tuple[HumanPreferencePredictor, Dict]:
    """
    Обучение регрессионной модели
    """
    
    model = HumanPreferencePredictor(
        n_ml_features=len(train_dataset.feature_cols),
        hidden_dims=config.hidden_dims,
        dropout=config.dropout,
        predict_uncertainty=True
    )
    
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay
    )
    
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=config.num_epochs
    )
    
    loss_fn = UncertaintyWeightedLoss(use_human_uncertainty=True)
    
    train_loader = DataLoader(train_dataset, batch_size=config.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=config.batch_size)
    
    best_val_loss = float('inf')
    best_model_state = None
    history = {'train_loss': [], 'val_loss': [], 'val_metrics': []}
    
    for epoch in range(config.num_epochs):
        # Training
        model.train()
        train_losses = []
        
        for features, targets, stds in train_loader:
            optimizer.zero_grad()
            
            predictions = model(features)
            loss = loss_fn(predictions, targets, stds)
            
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), config.grad_clip)
            optimizer.step()
            
            train_losses.append(loss.item())
        
        # Validation
        model.eval()
        val_losses = []
        all_preds = {task: [] for task in ['fidelity', 'alignment', 'consistency']}
        all_targets = {task: [] for task in ['fidelity', 'alignment', 'consistency']}
        
        with torch.no_grad():
            for features, targets, stds in val_loader:
                predictions = model(features)
                loss = loss_fn(predictions, targets, stds)
                val_losses.append(loss.item())
                
                for task in targets.keys():
                    all_preds[task].extend(predictions[task]['mean'].cpu().numpy())
                    all_targets[task].extend(targets[task].cpu().numpy())
        
        # Calculate metrics
        val_metrics = {}
        for task in all_preds.keys():
            if all_preds[task]:
                preds = np.array(all_preds[task])
                targets_arr = np.array(all_targets[task])
                
                val_metrics[f'{task}_pearson'] = pearsonr(preds, targets_arr)[0]
                val_metrics[f'{task}_spearman'] = spearmanr(preds, targets_arr)[0]
                val_metrics[f'{task}_mae'] = np.mean(np.abs(preds - targets_arr))
        
        # Logging
        avg_train_loss = np.mean(train_losses)
        avg_val_loss = np.mean(val_losses)
        
        history['train_loss'].append(avg_train_loss)
        history['val_loss'].append(avg_val_loss)
        history['val_metrics'].append(val_metrics)
        
        print(f"Epoch {epoch+1}/{config.num_epochs}")
        print(f"  Train Loss: {avg_train_loss:.4f}")
        print(f"  Val Loss: {avg_val_loss:.4f}")
        print(f"  Val Metrics: {val_metrics}")
        
        # Save best model
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_model_state = model.state_dict().copy()
        
        scheduler.step()
    
    # Load best model
    model.load_state_dict(best_model_state)
    
    return model, history
```

### 7.4 Альтернативные модели

#### 7.4.1 Gradient Boosting (XGBoost / LightGBM)

```python
from xgboost import XGBRegressor
from sklearn.multioutput import MultiOutputRegressor

def train_gradient_boosting(X_train, y_train, X_val, y_val):
    """
    Gradient Boosting как baseline модель
    
    Преимущества:
    - Не требует большого количества данных
    - Интерпретируемость (feature importance)
    - Быстрое обучение
    
    Недостатки:
    - Не моделирует uncertainty напрямую
    - Менее гибкий для multi-task learning
    """
    
    base_model = XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42
    )
    
    model = MultiOutputRegressor(base_model)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_val)
    
    metrics = {}
    for i, task in enumerate(['fidelity', 'alignment', 'consistency']):
        if i < y_val.shape[1]:
            metrics[f'{task}_pearson'] = pearsonr(y_pred[:, i], y_val[:, i])[0]
            metrics[f'{task}_mae'] = np.mean(np.abs(y_pred[:, i] - y_val[:, i]))
    
    return model, metrics
```

#### 7.4.2 Ensemble подход

```python
class EnsemblePredictor:
    """
    Ensemble из нескольких моделей для более робастных предсказаний
    """
    
    def __init__(self):
        self.models = {
            'neural': HumanPreferencePredictor(...),
            'xgboost': MultiOutputRegressor(XGBRegressor(...)),
            'lightgbm': MultiOutputRegressor(LGBMRegressor(...)),
        }
        self.weights = {'neural': 0.5, 'xgboost': 0.25, 'lightgbm': 0.25}
    
    def predict(self, X):
        predictions = {}
        
        for name, model in self.models.items():
            pred = model.predict(X)
            for task_idx, task in enumerate(['fidelity', 'alignment', 'consistency']):
                if task not in predictions:
                    predictions[task] = []
                predictions[task].append(self.weights[name] * pred[:, task_idx])
        
        # Weighted average
        final_predictions = {
            task: np.sum(preds, axis=0)
            for task, preds in predictions.items()
        }
        
        return final_predictions
```

---

## 8. Валидация и контроль качества

### 8.1 Метрики качества регрессии

#### 8.1.1 Основные метрики

| Метрика | Формула | Интерпретация |
|---------|---------|---------------|
| **Pearson r** | corr(pred, true) | Линейная корреляция; > 0.7 — хорошо |
| **Spearman ρ** | rank_corr(pred, true) | Ранговая корреляция; > 0.7 — хорошо |
| **MAE** | mean(\|pred - true\|) | Средняя ошибка в баллах; < 1.0 — хорошо |
| **RMSE** | sqrt(mean((pred - true)²)) | Чувствителен к выбросам |

#### 8.1.2 Ranking Metrics

```python
def calculate_ranking_metrics(predictions: np.ndarray, targets: np.ndarray) -> Dict:
    """
    Метрики качества ранжирования
    
    Важны для задачи сравнения моделей:
    если модель A лучше B по human rating,
    должна быть лучше и по predicted rating
    """
    
    # Pairwise ranking accuracy
    n = len(predictions)
    correct_pairs = 0
    total_pairs = 0
    
    for i in range(n):
        for j in range(i + 1, n):
            if targets[i] != targets[j]:
                total_pairs += 1
                # Проверяем, что порядок сохранён
                if (predictions[i] > predictions[j]) == (targets[i] > targets[j]):
                    correct_pairs += 1
    
    pairwise_accuracy = correct_pairs / total_pairs if total_pairs > 0 else 0
    
    # Kendall's Tau
    tau, p_value = kendalltau(predictions, targets)
    
    # NDCG (если есть грейды качества)
    # Делим на квантили и оцениваем качество ранжирования
    
    return {
        'pairwise_ranking_accuracy': pairwise_accuracy,
        'kendall_tau': tau,
        'kendall_p_value': p_value
    }
```

### 8.2 Стратегия валидации

#### 8.2.1 Cross-Validation схема

```python
def stratified_cross_validation(
    data: pd.DataFrame,
    n_folds: int = 5,
    stratify_by: List[str] = ['domain', 'task']
) -> Iterator[Tuple[pd.DataFrame, pd.DataFrame]]:
    """
    Stratified K-Fold с учётом домена и задачи
    
    Обеспечивает:
    1. Пропорциональное представительство всех domain-task комбинаций
    2. Отсутствие data leakage
    """
    
    from sklearn.model_selection import StratifiedKFold
    
    # Create stratification key
    data['strat_key'] = data[stratify_by].astype(str).agg('_'.join, axis=1)
    
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    
    for train_idx, val_idx in skf.split(data, data['strat_key']):
        train_data = data.iloc[train_idx]
        val_data = data.iloc[val_idx]
        yield train_data, val_data
```

#### 8.2.2 Hold-out Test Set

```
Data Split:
├── Training Set (70%)     → Обучение модели
├── Validation Set (15%)   → Подбор гиперпараметров
└── Test Set (15%)         → Финальная оценка

Важно:
- Test set создаётся ДО начала экспериментов
- Используется ТОЛЬКО для финальной оценки
- Содержит все domain-task комбинации
```

### 8.3 Анализ ошибок

#### 8.3.1 Error Analysis Pipeline

```python
def analyze_errors(
    predictions: pd.DataFrame,
    targets: pd.DataFrame,
    threshold: float = 2.0
) -> ErrorAnalysisReport:
    """
    Детальный анализ ошибок модели
    """
    
    # Calculate errors
    errors = predictions - targets
    abs_errors = errors.abs()
    
    report = ErrorAnalysisReport()
    
    # 1. Общая статистика ошибок
    report.overall_stats = {
        'mean_error': errors.mean(),
        'std_error': errors.std(),
        'mae': abs_errors.mean(),
        'max_error': abs_errors.max()
    }
    
    # 2. Ошибки по категориям
    for category in ['domain', 'task', 'prompt_complexity']:
        report.errors_by_category[category] = (
            abs_errors.groupby(category).mean()
        )
    
    # 3. Большие ошибки (> threshold)
    large_errors_mask = abs_errors > threshold
    report.large_error_samples = predictions[large_errors_mask.any(axis=1)]
    
    # 4. Систематические смещения
    report.bias_analysis = {
        task: {
            'mean_bias': errors[task].mean(),
            'positive_bias_ratio': (errors[task] > 0).mean()
        }
        for task in errors.columns
    }
    
    # 5. Корреляция ошибок с входными фичами
    for feature in ['clip_score', 'ssae_score', 'aesthetic_score']:
        report.error_feature_correlation[feature] = {
            task: pearsonr(abs_errors[task], predictions[feature])[0]
            for task in abs_errors.columns
        }
    
    return report
```

#### 8.3.2 Типичные проблемы и решения

| Проблема | Диагностика | Решение |
|----------|-------------|---------|
| **High bias** | MAE на train ≈ MAE на val, оба высокие | Увеличить сложность модели |
| **High variance** | MAE на train << MAE на val | Добавить регуляризацию, больше данных |
| **Domain-specific errors** | MAE сильно различается по доменам | Добавить domain-specific фичи или модели |
| **Calibration issues** | Predicted uncertainty не соответствует actual | Recalibrate uncertainty |

### 8.4 Мониторинг в production

```python
class ProductionMonitor:
    """
    Мониторинг качества модели в production
    """
    
    def __init__(self, model, reference_stats):
        self.model = model
        self.reference_stats = reference_stats  # Stats from validation set
        self.prediction_history = []
    
    def check_prediction(self, ml_metrics: np.ndarray) -> Dict:
        """Проверка каждого предсказания"""
        
        prediction = self.model.predict(ml_metrics)
        
        alerts = []
        
        # 1. Out-of-distribution detection
        if self._is_ood(ml_metrics):
            alerts.append('OOD_INPUT')
        
        # 2. Prediction confidence
        if prediction['uncertainty'] > self.reference_stats['max_uncertainty']:
            alerts.append('LOW_CONFIDENCE')
        
        # 3. Track for drift detection
        self.prediction_history.append({
            'timestamp': datetime.now(),
            'input': ml_metrics,
            'prediction': prediction
        })
        
        return {
            'prediction': prediction,
            'alerts': alerts
        }
    
    def check_drift(self, window_size: int = 1000) -> Dict:
        """Проверка drift в распределении предсказаний"""
        
        recent = self.prediction_history[-window_size:]
        
        recent_predictions = np.array([p['prediction']['mean'] for p in recent])
        
        drift_metrics = {}
        for task in ['fidelity', 'alignment', 'consistency']:
            # KS-test against reference distribution
            stat, p_value = ks_2samp(
                recent_predictions[:, task],
                self.reference_stats[f'{task}_distribution']
            )
            
            drift_metrics[task] = {
                'ks_statistic': stat,
                'p_value': p_value,
                'drift_detected': p_value < 0.05
            }
        
        return drift_metrics
```

---

## 9. Практическая реализация

### 9.1 Структура проекта

```
GenImagesPipeline/
├── README.md
├── EVALUATION_METHODOLOGY.md          # Этот документ
├── requirements.txt
├── config/
│   ├── default.yaml                   # Дефолтные параметры
│   └── production.yaml                # Production конфигурация
├── data/
│   ├── raw/                           # Исходные данные
│   │   ├── prompts/                   # Промпты по доменам
│   │   └── images/                    # Сгенерированные изображения
│   ├── processed/                     # Обработанные данные
│   │   ├── ml_metrics.parquet         # ML метрики
│   │   └── human_ratings.parquet      # Экспертные оценки
│   └── gold_samples/                  # Эталонные примеры
├── src/
│   ├── __init__.py
│   ├── dataset/
│   │   ├── prompt_generator.py        # Генерация промптов
│   │   ├── data_validator.py          # Валидация данных
│   │   └── data_loader.py             # Загрузка данных
│   ├── metrics/
│   │   ├── clip_score.py
│   │   ├── ssae.py
│   │   ├── aesthetic_score.py
│   │   ├── dino_similarity.py
│   │   └── metrics_pipeline.py        # Orchestration
│   ├── annotation/
│   │   ├── annotation_app.py          # UI для аннотации
│   │   ├── aggregation.py             # Агрегация оценок
│   │   └── quality_control.py         # Контроль качества
│   ├── regression/
│   │   ├── models.py                  # Архитектуры моделей
│   │   ├── training.py                # Обучение
│   │   ├── evaluation.py              # Оценка
│   │   └── inference.py               # Инференс
│   └── utils/
│       ├── config.py
│       ├── logging.py
│       └── visualization.py
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_metrics_analysis.ipynb
│   └── 03_model_training.ipynb
├── tests/
│   ├── test_metrics.py
│   ├── test_aggregation.py
│   └── test_regression.py
└── scripts/
    ├── compute_metrics.py             # CLI для расчёта метрик
    ├── train_model.py                 # CLI для обучения
    └── evaluate_model.py              # CLI для оценки модели
```

### 9.2 Конфигурация

```yaml
# config/default.yaml

dataset:
  domains:
    - education
    - marketing
    - interior_design
    - architecture
    - fashion
    - gaming
    - photorealism
    - art_styles
  
  tasks:
    - text_to_image
    - inpainting
    - outpainting
    - style_transfer
    - object_replacement
    - background_replacement
    - enhancement
    - controlled_generation
  
  samples_per_cell: 100
  prompt_complexity_distribution:
    simple: 0.2
    medium: 0.5
    complex: 0.3

metrics:
  clip:
    model: "ViT-L/14"
    
  ssae:
    vlm_provider: "openai"
    vlm_model: "gpt-4-vision-preview"
    max_key_points: 15
    
  aesthetic:
    model: "laion-aesthetic-predictor-v2"
    
  dino:
    model: "facebook/dinov2-large"

annotation:
  experts_per_sample: 3
  gold_sample_ratio: 0.05
  min_expert_accuracy: 0.7
  disagreement_threshold: 2.5

regression:
  model_type: "neural"  # "neural", "xgboost", "ensemble"
  hidden_dims: [128, 64, 32]
  dropout: 0.2
  learning_rate: 0.001
  batch_size: 64
  num_epochs: 100
  early_stopping_patience: 10

validation:
  n_folds: 5
  test_size: 0.15
  stratify_by: ["domain", "task"]
```

### 9.3 CLI Commands

```bash
# 1. Генерация и сбор датасета
python scripts/generate_dataset.py \
    --config config/default.yaml \
    --output data/raw/

# 2. Расчёт ML метрик
python scripts/compute_metrics.py \
    --input data/raw/images/ \
    --output data/processed/ml_metrics.parquet \
    --config config/default.yaml

# 3. Запуск интерфейса аннотации
python scripts/run_annotation.py \
    --data data/raw/ \
    --output data/processed/human_ratings.parquet \
    --port 8080

# 4. Агрегация и валидация аннотаций
python scripts/aggregate_ratings.py \
    --ratings data/processed/human_ratings.parquet \
    --output data/processed/aggregated_ratings.parquet

# 5. Обучение регрессионной модели
python scripts/train_model.py \
    --ml_metrics data/processed/ml_metrics.parquet \
    --human_ratings data/processed/aggregated_ratings.parquet \
    --output models/regression_model.pt \
    --config config/default.yaml

# 6. Оценка модели
python scripts/evaluate_model.py \
    --model models/regression_model.pt \
    --test_data data/processed/test_set.parquet \
    --output reports/evaluation_report.json

# 7. Инференс на новых данных
python scripts/predict.py \
    --model models/regression_model.pt \
    --input new_images/ \
    --output predictions.csv
```

### 9.4 Ресурсные требования

| Компонент | CPU | GPU | RAM | Storage | Время |
|-----------|-----|-----|-----|---------|-------|
| ML Metrics (1000 img) | 8 cores | 1× A100 | 32 GB | 50 GB | ~2 hours |
| SSAE (1000 img) | 4 cores | - | 16 GB | - | ~4 hours (API) |
| Annotation (1000 img) | - | - | - | - | ~20 hours (manual) |
| Model Training | 4 cores | 1× V100 | 16 GB | 10 GB | ~1 hour |

### 9.5 Оценка стоимости

| Компонент | Unit Cost | Volume | Total |
|-----------|-----------|--------|-------|
| VLM API (SSAE) | $0.01/image | 5000 images | $50 |
| Human Annotation | $0.50/image | 5000 images × 3 experts | $7,500 |
| GPU Compute | $2/hour | 10 hours | $20 |
| **Total** | | | **~$7,600** |

---

## 10. Приложения

### 10.1 Примеры промптов по доменам

#### D1. Образование

```
Simple: "Схема строения атома водорода"
Medium: "Инфографика о фотосинтезе с подписями на русском языке"
Complex: "Детальная анатомическая схема человеческого сердца с указанием 
          всех камер, клапанов и крупных сосудов, в стиле медицинского учебника"
```

#### D3. Дизайн интерьеров

```
Simple: "Белый диван в гостиной"
Medium: "Современная кухня в скандинавском стиле с островом и барными стульями"
Complex: "Просторная гостиная-студия 50 кв.м в стиле лофт: кирпичные стены, 
          большие окна, кожаный диван, винтажный ковёр, промышленные светильники, 
          живые растения, вид на городской пейзаж, вечернее освещение"
```

### 10.2 Шаблоны для аннотаторов

#### Инструкция для эксперта

```markdown
# Инструкция по оценке сгенерированных изображений

## Общие правила
1. Оценивайте ТОЛЬКО то изображение, которое видите
2. Не учитывайте личные предпочтения в стиле
3. Оценивайте объективно по заданным критериям
4. При сомнениях выбирайте среднюю оценку

## Критерий: Fidelity (Качество)
- Смотрите на ТЕХНИЧЕСКОЕ качество
- Ищите артефакты, размытие, искажения
- Проверяйте анатомию людей/животных
- НЕ оценивайте соответствие промпту здесь

## Критерий: Alignment (Соответствие)
- Выделите ключевые элементы промпта
- Проверьте каждый элемент
- Оцените точность атрибутов (цвет, размер, количество)
- Проверьте пространственные отношения

## Критерий: Consistency (для редактирования)
- Сравните с исходным изображением
- Оцените сохранение идентичности объектов
- Проверьте границы редактирования
- НЕ учитывайте качество самого редактирования
```

### 10.3 Формулы и математические основы

#### Krippendorff's Alpha

```
α = 1 - D_o / D_e

где:
- D_o = observed disagreement
- D_e = expected disagreement by chance

Для interval data:
D_o = (1/n) Σ_c Σ_k (o_ck * (c - k)²)
D_e = (1/n(n-1)) Σ_c Σ_k (n_c * n_k * (c - k)²)
```

#### Fréchet Inception Distance (FID)

```
FID = ||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2(Σ_r Σ_g)^{1/2})

где:
- μ_r, Σ_r = mean, covariance of real images
- μ_g, Σ_g = mean, covariance of generated images
- Tr = trace of matrix
```

#### Heteroscedastic Loss

```
L = (1/2N) Σ_i [log(σ_i²) + (y_i - μ_i)² / σ_i²]

где:
- μ_i = predicted mean
- σ_i = predicted std (uncertainty)
- y_i = true value
```

---

## Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| 2.0 | 2026-02-02 | Первоначальная версия документа |

---

## Ссылки

1. [HunyuanImage 3.0 Technical Report](https://arxiv.org/html/2509.23951v1) — SSAE methodology
2. [CLIP: Learning Transferable Visual Models](https://arxiv.org/abs/2103.00020)
3. [DINOv2: Learning Robust Visual Features](https://arxiv.org/abs/2304.07193)
4. [LAION Aesthetic Predictor](https://github.com/LAION-AI/aesthetic-predictor)
5. [Krippendorff's Alpha](https://en.wikipedia.org/wiki/Krippendorff%27s_alpha)
