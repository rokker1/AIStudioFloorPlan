# Блок-схемы алгоритмов AIStudioFloorPlan

## Главная блок-схема приложения

```mermaid
flowchart TD
    START([Запуск приложения]) --> LANG{Выбор языка}
    
    LANG -->|繁體中文| STEP1
    LANG -->|English| STEP1
    
    subgraph STEP1 [Шаг 1: Загрузка плана]
        S1_1[Отображение интерфейса загрузки]
        S1_2[Пользователь выбирает файл]
        S1_3[FileReader преобразует в Base64]
        S1_4[Сохранение в uploadedImage]
        S1_5{План загружен?}
        
        S1_1 --> S1_2 --> S1_3 --> S1_4 --> S1_5
    end
    
    S1_5 -->|Нет| S1_1
    S1_5 -->|Да| STEP2
    
    subgraph STEP2 [Шаг 2: AI-рендеринг]
        S2_1[Отображение оригинала и области рендера]
        S2_2[Выбор количества вариантов]
        S2_3[Нажатие 'Начать рендеринг']
        S2_4[Вызов generateAIRendering]
        S2_5{Несколько вариантов?}
        S2_6[Выбор из сетки]
        S2_7[Подтверждение результата]
        S2_8[Режим редактирования]
        S2_9{Требуется коррекция?}
        S2_10[Рисование маски + промпт]
        S2_11[Применение коррекции]
        S2_12{Результат OK?}
        
        S2_1 --> S2_2 --> S2_3 --> S2_4 --> S2_5
        S2_5 -->|Да| S2_6 --> S2_7
        S2_5 -->|Нет| S2_7
        S2_7 -->|Принять| S2_8
        S2_7 -->|Отклонить| S2_3
        S2_8 --> S2_9
        S2_9 -->|Да| S2_10 --> S2_11 --> S2_12
        S2_12 -->|Нет| S2_10
        S2_12 -->|Да| S2_9
    end
    
    S2_9 -->|Нет| STEP3
    
    subgraph STEP3 [Шаг 3: Генерация сцен]
        S3_1[Отображение плана с canvas]
        S3_2[Выбор/ввод стиля интерьера]
        S3_3[Клик на плане - добавление точки]
        S3_4{Точек достаточно?}
        S3_5[Нажатие 'Генерация сцен']
        S3_6[Параллельная генерация всех сцен]
        S3_7[Отображение сетки результатов]
        S3_8{Настройка камеры?}
        S3_9[Изменение rotation/tilt/zoom]
        S3_10[Перегенерация сцены]
        
        S3_1 --> S3_2 --> S3_3 --> S3_4
        S3_4 -->|Нет| S3_3
        S3_4 -->|Да| S3_5 --> S3_6 --> S3_7 --> S3_8
        S3_8 -->|Да| S3_9 --> S3_10 --> S3_7
    end
    
    S3_8 -->|Нет| STEP4
    
    subgraph STEP4 [Шаг 4: Редактирование сцен]
        S4_1[Отображение карточек сцен]
        S4_2{Тип редактирования}
        S4_3[Текстовый промпт]
        S4_4[Загрузка объекта]
        S4_5[Рисование маски]
        S4_6[Настройка освещения]
        S4_7[Применение изменений]
        S4_8[editInteriorScene]
        S4_9[Обновление сцены]
        S4_10{Продолжить редактирование?}
        
        S4_1 --> S4_2
        S4_2 -->|Промпт| S4_3 --> S4_7
        S4_2 -->|Объект| S4_4 --> S4_7
        S4_2 -->|Маска| S4_5 --> S4_7
        S4_2 -->|Освещение| S4_6 --> S4_7
        S4_7 --> S4_8 --> S4_9 --> S4_10
        S4_10 -->|Да| S4_2
    end
    
    S4_10 -->|Нет| STEP5
    
    subgraph STEP5 [Шаг 5: Презентация]
        S5_1[Генерация текстов презентации]
        S5_2[Выбор цветовой темы]
        S5_3[generateSlides создает слайды]
        S5_4[Отображение превью слайдов]
        S5_5{Редактирование текста?}
        S5_6[Открыть EditSlideModal]
        S5_7[Сохранить изменения]
        S5_8[Перегенерация слайдов]
        S5_9{Финальное действие}
        S5_10[Просмотр слайдшоу]
        S5_11[Скачивание ZIP]
        
        S5_1 --> S5_2 --> S5_3 --> S5_4 --> S5_5
        S5_5 -->|Да| S5_6 --> S5_7 --> S5_8 --> S5_4
        S5_5 -->|Нет| S5_9
        S5_9 -->|Просмотр| S5_10
        S5_9 -->|Скачать| S5_11
    end
    
    S5_10 --> END([Завершение])
    S5_11 --> END
```

---

## Детальная схема генерации изображения

```mermaid
flowchart TD
    START([Запрос на генерацию]) --> CHECK{Тип запроса}
    
    CHECK -->|Без базового<br/>изображения| GEN[/v1/images/generations]
    CHECK -->|С базовым<br/>изображением| EDIT[/v1/images/edits]
    
    GEN --> GEN_REQ[JSON запрос:<br/>prompt, model, n,<br/>response_format]
    
    EDIT --> EDIT_REQ[FormData запрос:<br/>prompt, model, image]
    EDIT_REQ --> HAS_MASK{Есть маска?}
    HAS_MASK -->|Да| ADD_MASK[+ mask blob]
    HAS_MASK -->|Нет| HAS_REF{Есть reference?}
    ADD_MASK --> HAS_REF
    HAS_REF -->|Да| ADD_REF[+ reference_image blob]
    HAS_REF -->|Нет| SEND
    ADD_REF --> SEND
    
    GEN_REQ --> SEND[Отправка на<br/>IMAGE_API_BASE]
    
    SEND --> RESPONSE{Ответ сервера}
    
    RESPONSE -->|Успех| PARSE[Парсинг JSON]
    RESPONSE -->|Ошибка| RETRY{Попытка < 5?}
    
    RETRY -->|Да| BACKOFF[Экспоненциальная<br/>задержка]
    BACKOFF --> SEND
    RETRY -->|Нет| ERROR([Выброс исключения])
    
    PARSE --> FORMAT{Формат данных}
    
    FORMAT -->|b64_json| B64[data:image/png;base64,<br/>+ payload.data[0].b64_json]
    FORMAT -->|url| FETCH[fetchImageAsDataUrl<br/>загрузка по URL]
    FORMAT -->|Нет данных| ERROR
    
    B64 --> RESULT([DataURL изображения])
    FETCH --> RESULT
```

---

## Схема создания слайда презентации

```mermaid
flowchart TD
    START([Создание слайда]) --> CANVAS[Создание canvas<br/>1920 × 1080]
    
    CANVAS --> CTX[Получение 2D context]
    CTX --> BG[Заливка фоновым<br/>цветом темы]
    
    BG --> TYPE{Тип слайда}
    
    TYPE -->|Титульный| T_IMG[Загрузка первой сцены]
    TYPE -->|Концепция| C_IMG[Загрузка плана]
    TYPE -->|Точка обзора| V_IMG[Загрузка сцены N]
    TYPE -->|Заключение| E_IMG[Загрузка последней сцены]
    
    T_IMG --> DRAW_IMG
    C_IMG --> DRAW_IMG
    V_IMG --> DRAW_IMG
    E_IMG --> DRAW_IMG
    
    DRAW_IMG[drawFullBleedImage<br/>заполнение с обрезкой]
    
    DRAW_IMG --> BANNER[Рисование баннера<br/>полупрозрачный фон<br/>Y: 60%, H: 40%]
    
    BANNER --> TEXT_TYPE{Текст слайда}
    
    TEXT_TYPE -->|Титульный| T_TEXT[presentationTitle<br/>по центру]
    TEXT_TYPE -->|Концепция| C_TEXT[mainConcepts<br/>4 пункта]
    TEXT_TYPE -->|Точка обзора| V_TEXT[title + description]
    TEXT_TYPE -->|Заключение| E_TEXT[conclusionTitle<br/>+ conclusion]
    
    T_TEXT --> AUTO_SIZE
    C_TEXT --> AUTO_SIZE
    V_TEXT --> AUTO_SIZE
    E_TEXT --> AUTO_SIZE
    
    AUTO_SIZE[drawTextWithAutoSize<br/>автоподбор размера шрифта]
    
    AUTO_SIZE --> EXPORT[canvas.toDataURL<br/>'image/png']
    
    EXPORT --> RESULT([PNG DataURL])
```

---

## Схема рисования маски

```mermaid
flowchart TD
    START([Начало рисования]) --> SETUP[Создание DrawingCanvas]
    
    SETUP --> LOAD[Загрузка базового<br/>изображения]
    LOAD --> RESIZE[Установка размера canvas<br/>= размеру изображения]
    
    RESIZE --> WAIT{Событие<br/>пользователя}
    
    WAIT -->|pointerdown| DOWN[startDrawing]
    DOWN --> BEGIN[ctx.beginPath<br/>ctx.moveTo x,y]
    BEGIN --> MOVE
    
    WAIT -->|pointermove| MOVE{isDrawing?}
    MOVE -->|Да| DRAW[ctx.lineTo x,y<br/>ctx.stroke]
    DRAW --> WAIT
    MOVE -->|Нет| WAIT
    
    WAIT -->|pointerup/leave| UP[stopDrawing]
    UP --> MASK[getMaskBase64]
    
    MASK --> CREATE[Создание maskCanvas]
    CREATE --> COPY[Копирование рисунка]
    COPY --> WHITE[source-in: заливка белым<br/>замена цвета штрихов]
    WHITE --> BLACK[destination-over:<br/>черный фон]
    BLACK --> EXPORT[toDataURL → Base64]
    
    EXPORT --> RESULT([Черно-белая маска])
    
    WAIT -->|clearCanvas| CLEAR[ctx.clearRect]
    CLEAR --> WAIT
```

---

## Схема генерации интерьерной сцены

```mermaid
flowchart TD
    START([generateInteriorScene]) --> PARAMS[Параметры:<br/>planImage, x, y, style,<br/>viewIndex, camera, mode, temp]
    
    PARAMS --> CANVAS[Создание canvas<br/>с размерами изображения]
    
    CANVAS --> DRAW_IMG[Рисование плана<br/>на canvas]
    
    DRAW_IMG --> MARK[Рисование метки<br/>точки обзора]
    
    MARK --> CIRCLE[Красный круг<br/>radius=25, opacity=0.8]
    CIRCLE --> NUMBER[Белый номер<br/>в центре круга]
    NUMBER --> STROKE[Белая обводка<br/>lineWidth=4]
    
    STROKE --> B64[Конвертация canvas<br/>в Base64]
    
    B64 --> CAMERA{Настройки камеры}
    
    CAMERA -->|rotation ≠ 0| CAM_ROT[+ инструкция поворота]
    CAMERA -->|tilt ≠ 0| CAM_TILT[+ инструкция наклона]
    CAMERA -->|zoom ≠ 1| CAM_ZOOM[+ инструкция масштаба]
    
    CAM_ROT --> PROMPT
    CAM_TILT --> PROMPT
    CAM_ZOOM --> PROMPT
    CAMERA -->|Дефолт| PROMPT
    
    PROMPT[Формирование промпта]
    
    PROMPT --> P1[1. Photorealistic FIRST-PERSON VIEW<br/>from viewpoint N]
    P1 --> P2[2. STYLE: '${style}']
    P2 --> P3[3. LIGHTING: day/night +<br/>температура ${temp}K]
    P3 --> P4[4. CAMERA: eye-level 1.6m<br/>+ camera instructions]
    P4 --> P5[5. COMPOSITION: walls, ceiling,<br/>floor, furniture]
    P5 --> P6[6. CRITICAL: ground-level,<br/>NO aerial views]
    
    P6 --> VARIATION[generatePromptVariations<br/>+ timestamp + random suffix]
    
    VARIATION --> API[generateArchitecturalImage<br/>prompt + baseImage]
    
    API --> RESULT([URL сгенерированной сцены])
```

---

## Схема редактирования сцены

```mermaid
flowchart TD
    START([editInteriorScene]) --> PARAMS[Параметры:<br/>baseImage, prompt,<br/>mode, temp, mask?, object?]
    
    PARAMS --> CONVERT[imageSrcToInlineData<br/>baseImage → InlineData]
    
    CONVERT --> LIGHT[Формирование описания<br/>освещения]
    
    LIGHT --> MODE{mode}
    MODE -->|day| DAY[Яркое естественное<br/>освещение от окон<br/>temp K]
    MODE -->|night| NIGHT[Драматическое ночное<br/>искусственный свет<br/>темное небо за окнами]
    
    DAY --> CHECK_OBJ
    NIGHT --> CHECK_OBJ
    
    CHECK_OBJ{Есть объект?}
    
    CHECK_OBJ -->|Да| OBJ_MASK{Есть маска?}
    CHECK_OBJ -->|Нет| NO_OBJ_MASK{Есть маска?}
    
    OBJ_MASK -->|Да| CASE1[СЛУЧАЙ 1:<br/>Объект + Маска]
    OBJ_MASK -->|Нет| CASE2[СЛУЧАЙ 2:<br/>Только объект]
    
    NO_OBJ_MASK -->|Да| CASE3[СЛУЧАЙ 3:<br/>Только маска]
    NO_OBJ_MASK -->|Нет| CASE4[СЛУЧАЙ 4:<br/>Общее редактирование]
    
    CASE1 --> P1[Промпт: разместить объект<br/>в белой области маски<br/>+ инструкция пользователя]
    CASE2 --> P2[Промпт: интегрировать<br/>объект в сцену<br/>+ инструкция размещения]
    CASE3 --> P3[Промпт: изменить только<br/>белую область маски<br/>+ инструкция пользователя]
    CASE4 --> P4[Промпт: применить<br/>общее изменение<br/>+ настройки освещения]
    
    P1 --> COMMON[ОБЩИЕ ИНСТРУКЦИИ:<br/>- Сохранить перспективу<br/>- Фотореалистичность<br/>- Бесшовное смешивание<br/>- Только ground-level]
    P2 --> COMMON
    P3 --> COMMON
    P4 --> COMMON
    
    COMMON --> API[generateArchitecturalImage<br/>prompt + baseImage<br/>+ maskImage? + referenceImage?]
    
    API --> RESULT([URL отредактированной сцены])
```

---

## Схема состояний приложения

```mermaid
stateDiagram-v2
    [*] --> language: Запуск
    
    language --> step1: Выбор языка
    
    step1 --> step2: uploadedImage ✓
    step1 --> step1: Загрузка изображения
    
    step2 --> step3: renderedImage ✓
    step2 --> step1: Назад
    step2 --> step2: Редактирование плана
    
    step3 --> step4: generatedScenes.length > 0
    step3 --> step2: Назад
    step3 --> step3: Добавление точек<br/>Генерация сцен
    
    step4 --> step5: Далее
    step4 --> step3: Назад
    step4 --> step4: Редактирование сцен
    
    step5 --> step4: Назад
    step5 --> [*]: Скачивание/Завершение
    step5 --> step5: Редактирование слайдов<br/>Смена темы
    
    step1 --> step1: Сброс (restart)
    step2 --> step1: Сброс (restart)
    step3 --> step1: Сброс (restart)
    step4 --> step1: Сброс (restart)
    step5 --> step1: Сброс (restart)
```

---

## Схема передачи данных между компонентами

```mermaid
flowchart LR
    subgraph App.tsx
        STATE[Глобальное состояние]
    end
    
    subgraph Компоненты
        S1[Step1Upload]
        S2[Step2Rendering]
        S3[Step3SceneGeneration]
        S4[Step4SceneEditing]
        S5[Step5Presentation]
    end
    
    STATE -->|language| S1
    STATE -->|language| S2
    STATE -->|language| S3
    STATE -->|language| S4
    STATE -->|language| S5
    
    S1 -->|onImageUpload| STATE
    STATE -->|uploadedImage| S2
    
    S2 -->|onRenderingComplete| STATE
    STATE -->|renderedImage| S3
    STATE -->|renderedImage| S5
    
    STATE -->|style| S3
    S3 -->|onStyleChange| STATE
    
    STATE -->|scenePoints| S3
    S3 -->|onScenePointsChange| STATE
    
    STATE -->|generatedScenes| S3
    STATE -->|generatedScenes| S4
    STATE -->|generatedScenes| S5
    
    S3 -->|onScenesChange| STATE
    S4 -->|onScenesChange| STATE
```

---

## Схема взаимодействия с AI API

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant C as Компонент
    participant S as geminiService
    participant T as Text API :8000
    participant I as Image API :8001
    
    Note over U,I: Сценарий 1: Рендеринг плана
    U->>C: Нажать "Начать рендеринг"
    C->>S: generateAIRendering(image, prompt)
    S->>I: POST /v1/images/edits
    I-->>S: { data: [{ b64_json }] }
    S-->>C: DataURL изображения
    C-->>U: Отображение результата
    
    Note over U,I: Сценарий 2: Предложение стиля
    U->>C: Нажать "Предложить стиль"
    C->>S: suggestInteriorStyle(planImage)
    S->>T: POST /v1/chat/completions
    Note right of T: + image_url в content
    T-->>S: { choices: [{ message }] }
    S-->>C: "Modern Minimalist"
    C-->>U: Заполнение поля стиля
    
    Note over U,I: Сценарий 3: Генерация сцены
    U->>C: Нажать "Генерация сцен"
    loop Для каждой точки
        C->>S: generateInteriorScene(plan, x, y, style, ...)
        S->>S: Создание canvas с меткой
        S->>I: POST /v1/images/edits
        I-->>S: { data: [{ b64_json }] }
        S-->>C: DataURL сцены
    end
    C-->>U: Отображение всех сцен
    
    Note over U,I: Сценарий 4: Редактирование сцены
    U->>C: Рисование маски + промпт
    U->>C: Нажать "Применить"
    C->>S: editInteriorScene(scene, prompt, mode, temp, mask)
    S->>I: POST /v1/images/edits
    Note right of I: FormData: image + mask + prompt
    I-->>S: { data: [{ b64_json }] }
    S-->>C: DataURL измененной сцены
    C-->>U: Обновление карточки сцены
    
    Note over U,I: Сценарий 5: Генерация презентации
    U->>C: Переход к Шагу 5
    C->>S: generatePresentationText(plan, scenes, style, lang)
    S->>T: POST /v1/chat/completions
    Note right of T: + несколько image_url
    T-->>S: { choices: [{ message: JSON }] }
    S-->>C: PresentationText
    C->>C: generateSlides()
    C-->>U: Отображение слайдов
```
