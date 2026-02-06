# Структуры данных и API

## Глобальное состояние приложения (App.tsx)

```typescript
// Состояние текущего шага
type AppState = 'language' | 'step1' | 'step2' | 'step3' | 'step4' | 'step5';

// Основные переменные состояния
const [currentStep, setCurrentStep] = useState<AppState>('language');
const [language, setLanguage] = useState<Language>('zh');
const [uploadedImage, setUploadedImage] = useState<string>('');        // Base64 исходного плана
const [renderedImage, setRenderedImage] = useState<string>('');        // Base64 отрендеренного плана
const [style, setStyle] = useState<string>('');                        // Выбранный стиль интерьера
const [generatedScenes, setGeneratedScenes] = useState<GeneratedScene[]>([]);
const [scenePoints, setScenePoints] = useState<ScenePoint[]>([]);      // Точки обзора на плане
```

---

## Типы данных

### Language (языковые настройки)

```typescript
type Language = 'en' | 'zh';
```

### ScenePoint (точка обзора)

```typescript
interface ScenePoint {
    x: number;  // Координата X на canvas (в пикселях отображения)
    y: number;  // Координата Y на canvas (в пикселях отображения)
}
```

### GeneratedScene (сгенерированная сцена)

```typescript
interface GeneratedScene {
    url: string;              // DataURL текущего изображения сцены
    originalUrl: string;      // DataURL оригинала (для восстановления)
    viewIndex: number;        // Номер точки обзора (1-8)
    style: string;            // Примененный стиль дизайна
    isLoading: boolean;       // Флаг загрузки/генерации
    error?: string;           // Сообщение об ошибке (опционально)
    camera: {
        rotation: number;     // Поворот камеры по горизонтали (-180° до 180°)
        tilt: number;         // Наклон камеры по вертикали (-45° до 45°)
        zoom: number;         // Коэффициент масштабирования (0.5 до 2.0)
    };
    mode: 'day' | 'night';    // Режим освещения
    temperature: number;      // Цветовая температура в Кельвинах (2700K-7500K)
}
```

### InlineData (данные изображения для API)

```typescript
interface InlineData {
    mimeType: string;  // Например: 'image/png', 'image/jpeg'
    data: string;      // Base64-закодированные данные (без префикса data:...)
}
```

### PresentationText (тексты презентации)

```typescript
interface PresentationText {
    presentationTitle: string;           // Креативный заголовок (макс. 10 слов)
    conceptTitle: string;                // Заголовок концепции (макс. 7 слов)
    mainConcepts: string[];             // 4 концепции (формат: "Название: Описание")
    viewpointDetails: {                 // Детали для каждой точки обзора
        title: string;                  // Название комнаты (макс. 7 слов)
        description: string;            // Описание (макс. 30 слов)
    }[];
    conclusionTitle: string;            // Заголовок заключения (макс. 7 слов)
    conclusion: string;                 // Текст заключения (макс. 40 слов)
}
```

### ColorTheme (цветовая тема презентации)

```typescript
type ColorThemeNameKey = 
    | 'themeModernBlue' 
    | 'themeEarthTones' 
    | 'themeMinimalistGray' 
    | 'themeVibrantCreative' 
    | 'themeElegantNoir' 
    | 'themeSakuraPink';

interface ColorTheme {
    nameKey: ColorThemeNameKey;    // Ключ для локализации названия
    colors: {
        background: string;        // Цвет фона (#FFFFFF)
        primaryText: string;       // Основной цвет текста (#1E3A8A)
        secondaryText: string;     // Вторичный цвет текста (#475569)
        accent: string;            // Акцентный цвет (#3B82F6)
        titleBackground: string;   // Фон баннера (rgba(255,255,255,0.7))
    };
}
```

### SlideData (данные слайда для редактирования)

```typescript
interface SlideData {
    type: 'title' | 'concept' | 'viewpoint' | 'conclusion';
    index?: number;           // Только для type='viewpoint' — индекс сцены
    slideIndex?: number;      // Индекс слайда в массиве
    content: {
        title?: string;       // Заголовок (для concept, viewpoint, conclusion)
        description: string;  // Основной текст
    };
}
```

### ImageHistory (история версий изображения)

```typescript
interface ImageHistory {
    url: string;          // DataURL версии изображения
    timestamp: number;    // Unix timestamp создания
}
```

---

## API сервисов

### Конфигурация подключения

```typescript
// Переменные окружения (.env.local)
const TEXT_API_BASE = import.meta.env.VITE_LOCAL_TEXT_API_BASE || 'http://localhost:8000';
const IMAGE_API_BASE = import.meta.env.VITE_LOCAL_IMAGE_API_BASE || 'http://localhost:8001';
const TEXT_MODEL = import.meta.env.VITE_LOCAL_TEXT_MODEL || 'qwen2.5-72b-instruct';
const VISION_MODEL = import.meta.env.VITE_LOCAL_VISION_MODEL || TEXT_MODEL;
const IMAGE_MODEL = import.meta.env.VITE_LOCAL_IMAGE_MODEL || 'qwen-image-edit';
const LOCAL_API_KEY = import.meta.env.VITE_LOCAL_API_KEY;
```

### Текстовая/Vision модель API

**Эндпоинт:** `POST {TEXT_API_BASE}/v1/chat/completions`

**Формат запроса:**
```typescript
interface ChatCompletionRequest {
    model: string;                    // "qwen2.5-72b-instruct" или VISION_MODEL
    messages: {
        role: 'user';
        content: Array<
            | { type: 'text'; text: string }
            | { type: 'image_url'; image_url: { url: string } }
        >;
    }[];
    temperature: number;              // 0.4 по умолчанию
}
```

**Формат ответа:**
```typescript
interface ChatCompletionResponse {
    choices: {
        message: {
            content: string;          // Текстовый ответ модели
        };
    }[];
}
```

**Пример использования:**
```typescript
const response = await fetch(`${TEXT_API_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCAL_API_KEY}`
    },
    body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'Analyze this floor plan...' },
                { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
            ]
        }],
        temperature: 0.4
    })
});
```

### Генерация изображений API

**Эндпоинт:** `POST {IMAGE_API_BASE}/v1/images/generations`

**Формат запроса:**
```typescript
interface ImageGenerationRequest {
    prompt: string;                   // Текстовое описание
    model: string;                    // IMAGE_MODEL
    n: number;                        // Количество изображений (1)
    response_format: 'b64_json';      // Формат ответа
}
```

**Формат ответа:**
```typescript
interface ImageGenerationResponse {
    data: {
        b64_json?: string;            // Base64 изображения
        url?: string;                 // URL изображения (альтернатива)
    }[];
}
```

### Редактирование изображений API

**Эндпоинт:** `POST {IMAGE_API_BASE}/v1/images/edits`

**Формат запроса (multipart/form-data):**
```
prompt: string                        // Описание изменений
model: string                         // IMAGE_MODEL
n: 1                                  // Количество результатов
response_format: b64_json             // Формат ответа
image: Blob (base-image.png)          // Базовое изображение
mask: Blob (mask-image.png)           // Маска (опционально)
reference_image: Blob (reference.png) // Референс объекта (опционально)
```

**Формат ответа:**
```typescript
interface ImageEditResponse {
    data: {
        b64_json?: string;            // Base64 результата
        url?: string;                 // URL результата (альтернатива)
    }[];
    // Альтернативный формат
    image?: {
        b64_json: string;
    };
}
```

---

## Функции сервиса geminiService.ts

### generateAIRendering

Рендеринг плана помещения в 3D-визуализацию.

```typescript
async function generateAIRendering(
    baseImageSrc: string,         // DataURL исходного плана
    promptOverride?: string,      // Кастомный промпт (опционально)
    maskBase64?: string,          // Base64 маски (опционально)
    numberOfImages: number = 1    // Количество вариантов
): Promise<string[]>              // Массив DataURL результатов
```

### generateInteriorScene

Генерация интерьерной сцены из точки обзора.

```typescript
async function generateInteriorScene(
    planImageSrc: string,         // DataURL плана
    pointX: number,               // X координата точки (в native пикселях)
    pointY: number,               // Y координата точки (в native пикселях)
    style: string,                // Стиль интерьера
    viewIndex: number,            // Номер точки обзора
    camera: {                     // Настройки камеры
        rotation: number;
        tilt: number;
        zoom: number;
    },
    mode: 'day' | 'night',        // Режим освещения
    temperature: number           // Цветовая температура
): Promise<string>                // DataURL сгенерированной сцены
```

### editInteriorScene

Редактирование существующей сцены.

```typescript
async function editInteriorScene(
    baseImageSrc: string,         // DataURL сцены
    prompt: string,               // Описание изменений
    mode: 'day' | 'night',        // Режим освещения
    temperature: number,          // Цветовая температура
    maskBase64?: string,          // Base64 маски (опционально)
    objectImageBase64?: string    // Base64 объекта (опционально)
): Promise<string>                // DataURL измененной сцены
```

### suggestInteriorStyle

Предложение стиля на основе анализа плана.

```typescript
async function suggestInteriorStyle(
    planImageSrc: string          // DataURL плана
): Promise<string>                // Название предложенного стиля
```

### suggestPlanImprovements

Предложение улучшений для плана.

```typescript
async function suggestPlanImprovements(
    planImageSrc: string          // DataURL плана
): Promise<string>                // Текст предложения
```

### suggestStyleIdeas

Получение списка популярных стилей.

```typescript
async function suggestStyleIdeas(): Promise<string[]>
// Возвращает массив из 6 названий стилей
// Fallback: ['Modern Minimalist', 'Scandinavian', 'Industrial Loft', 
//            'Bohemian Chic', 'Coastal', 'Japanese Zen']
```

### generatePresentationText

Генерация текстов для презентации.

```typescript
async function generatePresentationText(
    planImageSrc: string,         // DataURL плана
    scenes: GeneratedScene[],     // Массив сгенерированных сцен
    style: string,                // Стиль интерьера
    language: Language            // Язык вывода
): Promise<PresentationText>      // Структура текстов презентации
```

### imageSrcToBase64

Конвертация DataURL или URL в Base64.

```typescript
async function imageSrcToBase64(
    src: string                   // DataURL или HTTP URL
): Promise<string>                // Base64 строка (без префикса data:...)
```

### generateArchitecturalImage

Низкоуровневая функция генерации с повторными попытками.

```typescript
async function generateArchitecturalImage(options: {
    prompt: string;               // Текстовый промпт
    baseImage?: InlineData;       // Базовое изображение
    maskImage?: InlineData;       // Маска
    referenceImage?: InlineData;  // Референс объекта
}): Promise<string>               // DataURL результата
```

---

## Функции утилит presentationUtils.ts

### generateSlides

Создание всех слайдов презентации.

```typescript
async function generateSlides(
    text: PresentationText,       // Тексты презентации
    scenes: GeneratedScene[],     // Сгенерированные сцены
    planImage: string,            // DataURL плана
    style: string,                // Стиль интерьера
    language: Language,           // Язык
    theme: ColorTheme             // Цветовая тема
): Promise<string[]>              // Массив DataURL слайдов (PNG)
```

### loadImage

Загрузка изображения из URL.

```typescript
function loadImage(src: string): Promise<HTMLImageElement>
```

### getLines

Разбиение текста на строки с учетом ширины.

```typescript
function getLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string[]
```

### drawTextWithAutoSize

Рисование текста с автоподбором размера шрифта.

```typescript
function drawTextWithAutoSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number,
    maxWidth: number, maxHeight: number,
    baseFont: string,             // Например: 'bold 60px sans-serif'
    lineHeight: number,
    align: 'left' | 'center' | 'right' = 'left'
): void
```

### drawFullBleedImage

Рисование изображения с заполнением canvas.

```typescript
function drawFullBleedImage(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement
): void
// Заполняет весь canvas (1920x1080), обрезая изображение по меньшей стороне
```

---

## Константы презентации

```typescript
const CANVAS_WIDTH = 1920;        // Ширина слайда в пикселях
const CANVAS_HEIGHT = 1080;       // Высота слайда в пикселях
const PADDING = 80;               // Отступы от края
const BANNER_Y = 648;             // Y-позиция баннера (60% высоты)
const BANNER_HEIGHT = 432;        // Высота баннера (40% высоты)
const BANNER_PADDING = 120;       // Отступы внутри баннера
```

---

## Доступные цветовые темы

```typescript
const themes: ColorTheme[] = [
    {
        nameKey: 'themeModernBlue',
        colors: {
            background: '#FFFFFF',
            primaryText: '#1E3A8A',      // Темно-синий
            secondaryText: '#475569',    // Серый
            accent: '#3B82F6',           // Синий
            titleBackground: 'rgba(255, 255, 255, 0.7)'
        }
    },
    {
        nameKey: 'themeEarthTones',
        colors: {
            background: '#FBF9F6',
            primaryText: '#5D4037',      // Коричневый
            secondaryText: '#795548',
            accent: '#A1887F',
            titleBackground: 'rgba(255, 255, 255, 0.7)'
        }
    },
    {
        nameKey: 'themeMinimalistGray',
        colors: {
            background: '#F3F4F6',
            primaryText: '#111827',      // Почти черный
            secondaryText: '#4B5563',
            accent: '#6B7280',           // Серый
            titleBackground: 'rgba(255, 255, 255, 0.7)'
        }
    },
    {
        nameKey: 'themeVibrantCreative',
        colors: {
            background: '#FFFBEB',
            primaryText: '#854D0E',      // Темно-желтый
            secondaryText: '#B45309',
            accent: '#F59E0B',           // Оранжевый
            titleBackground: 'rgba(255, 255, 255, 0.7)'
        }
    },
    {
        nameKey: 'themeElegantNoir',
        colors: {
            background: '#212121',       // Темный
            primaryText: '#FFFFFF',      // Белый
            secondaryText: '#BDBDBD',
            accent: '#D4AF37',           // Золотой
            titleBackground: 'rgba(0, 0, 0, 0.6)'
        }
    },
    {
        nameKey: 'themeSakuraPink',
        colors: {
            background: '#FFF5F7',
            primaryText: '#5B21B6',      // Фиолетовый
            secondaryText: '#4A044E',
            accent: '#F472B6',           // Розовый
            titleBackground: 'rgba(255, 255, 255, 0.7)'
        }
    }
];
```

---

## Интерфейсы компонентов

### DrawingCanvasRef

```typescript
interface DrawingCanvasRef {
    clearCanvas: () => void;              // Очистить все нарисованное
    getMaskBase64: () => string;          // Получить маску в Base64
}
```

### DrawingCanvasProps

```typescript
interface DrawingCanvasProps {
    imageUrl: string;                     // URL базового изображения
    onMaskChange?: (maskDataUrl: string) => void;  // Callback при изменении
    className?: string;                   // Дополнительные CSS классы
}
```

---

## Переводы (i18n)

Система переводов использует объект `translations` с ключами:

```typescript
type TranslationKey = 
    // App.tsx
    | 'appTitle' | 'appSubtitle' | 'previousStep' | 'nextStep' | 'restart'
    // Stepper
    | 'stepUpload' | 'stepRendering' | 'stepGeneration' | 'step4SceneEditing' | 'step5Presentation'
    // Step1
    | 'step1Title' | 'step1Description' | 'uploadPlaceholder' | 'uploadButton' | 'reuploadButton' | 'analyzingIndicator'
    // Step2
    | 'step2Title' | 'step2Description' | 'originalPlanReference' | 'aiRenderingArea' | 'aiGenerating' | 'startRenderingButton' | ...
    // Step3
    | 'step3Title' | 'step3Description' | 'styleInputPlaceholder' | 'generateScenes' | 'viewpoint' | ...
    // Step4
    | 'step4Title' | 'step4Description' | 'editPromptPlaceholder' | 'applyEdit' | 'restoreOriginal' | ...
    // Step5
    | 'step5Title' | 'step5Description' | 'downloadPresentation' | 'viewSlideshow' | 'editSlide' | ...
    // Themes
    | 'themeModernBlue' | 'themeEarthTones' | 'themeMinimalistGray' | 'themeVibrantCreative' | 'themeElegantNoir' | 'themeSakuraPink'
    // Common
    | 'day' | 'night' | 'colorTemperature' | 'cancel' | 'saveChanges' | ...
```

Функция получения перевода:

```typescript
function getTranslation(key: TranslationKey, language: Language): string
```
