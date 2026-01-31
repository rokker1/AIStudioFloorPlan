# Обновление драйвера NVIDIA

**Сервер:** ds-1  
**Дата:** 2026-01-31  
**Было:** 525.60.11 (CUDA 12.0)  
**Стало:** 570.133.07 (CUDA 12.8)

## Команды

```bash
# Бэкап текущих пакетов
dpkg -l | grep nvidia > ~/nvidia-packages-backup.txt
cat ~/nvidia-packages-backup.txt

# Посмотреть доступные драйверы
apt-cache search nvidia-driver | grep -E "^nvidia-driver-[0-9]+"

# Удалить старый драйвер
sudo apt remove --purge nvidia-driver-525-open nvidia-dkms-525-open
sudo apt autoremove --purge

# Установить новый драйвер
sudo apt update
sudo apt install nvidia-driver-570

# Перезагрузка
sudo reboot
```

## Проверка после перезагрузки

```bash
nvidia-smi
```

## Результат

```
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 570.133.07             Driver Version: 570.133.07     CUDA Version: 12.8     |
|-----------------------------------------+------------------------+----------------------+
| GPU  Name                 Persistence-M | Bus-Id          Disp.A | Volatile Uncorr. ECC |
|   0  NVIDIA A10                     Off |   00000000:17:00.0 Off |                  Off |
+-----------------------------------------+------------------------+----------------------+
```

## Таблица совместимости драйверов

| Драйвер | CUDA | PyTorch |
|---------|------|---------|
| 525.x | 12.0 | cu118 |
| 535.x | 12.2 | cu121 |
| 550.x | 12.4 | cu124 |
| 570.x | 12.8 | cu124 |
