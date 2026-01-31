# ComfyUI Setup Guide

## Сервер
- Host: `ds-1`
- User: `alzhavoronkov`
- Рабочая директория: `~/source/comfyui`
- GPU: NVIDIA A10 (24GB VRAM)
- Driver: 570.133.07
- CUDA: 12.8

## Установка

### 1. Сборка Docker образа

```bash
cd ~/source/comfyui
./comfyui_build.sh
```

Образ: `comfyui-python313`

### 2. Запуск контейнера

```bash
docker run -d \
    --name comfyui \
    --gpus all \
    -p 8188:8188 \
    -v /home/alzhavoronkov:/home/alzhavoronkov \
    -v comfyui_data:/home/comfyui/comfy \
    --restart unless-stopped \
    comfyui-python313
```

### 3. Ручная установка внутри контейнера

```bash
# Войти в контейнер
docker exec -it comfyui bash

# Отключить tracking
comfy tracking disable

# Установить ComfyUI
comfy --workspace=/home/comfyui/workspace install

# Перейти в директорию и запустить
cd workspace/
python main.py --listen 0.0.0.0 --port 8188
```

## Доступ

- URL: http://ds-1:8188

## Полезные команды

```bash
# Логи контейнера
docker logs -f comfyui

# Войти в контейнер
docker exec -it comfyui bash

# Остановить контейнер
docker stop comfyui

# Запустить контейнер
docker start comfyui

# Удалить контейнер
docker rm -f comfyui

# Удалить volume (данные ComfyUI)
docker volume rm comfyui_data
```

## Структура

```
/home/comfyui/
├── venv/              # Python virtual environment
├── workspace/         # ComfyUI installation (через comfy-cli)
│   ├── models/        # Модели (checkpoints, loras, etc.)
│   ├── custom_nodes/  # Кастомные ноды
│   ├── input/         # Входные файлы
│   └── output/        # Выходные файлы
└── comfy/             # Docker volume (альтернативная точка монтирования)
```

## История установки

**Дата:** 2026-01-31

1. Обновлён драйвер NVIDIA: 525.60.11 → 570.133.07
2. Собран Docker образ с Python 3.13 и comfy-cli
3. Запущен контейнер с GPU passthrough
4. Установлен ComfyUI через comfy-cli
5. ComfyUI доступен на порту 8188
