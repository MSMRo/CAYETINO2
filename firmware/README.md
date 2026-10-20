# Firmware Cayetino ESP32

Este firmware para Arduino permite al ESP32 actuar como un generador de señales analógicas de alta fidelidad para prácticas de Ingeniería Biomédica.

## Características
1. **DAC Interno de 8 bits**:
   - Salida analógica por **GPIO 25** (DAC1) o **GPIO 26** (DAC2).
   - Rango de tensión de salida: `0.0 V` a `3.3 V` (256 niveles de cuantización).
2. **Sistema de Archivos Flash LittleFS**:
   - Almacena señales biomédicas y ondas sintéticas transferidas desde Streamlit.
   - Persistencia de datos al reiniciar la placa.
3. **Temporizador por Hardware `esp_timer` (64 bits)**:
   - Permite frecuencias de muestreo desde 10 Hz hasta 20 kHz con jitter despreciable.
   - Ejecución sin bloqueos del procesador, operando en bucle continuo de la ventana guardada.
4. **Protocolo Serial de Alta Fiabilidad**:
   - Velocidad: `115200 baudios`.
   - Control de flujo por bloques (`CHUNK` + `ACK_CHUNK`) para evitar pérdida de datos o desbordamiento de buffer serial.

## Instrucciones de Grabación y Flasheo del Firmware

### 🚀 Opción 1: Flasheo Automático con 1 Clic (Recomendado)
No necesitas abrir Arduino IDE ni compilar nada:
1. Conecta tu ESP32 por cable USB a tu computadora.
2. Haz doble clic en el archivo **`flash_esp32.bat`** (ubicado en esta carpeta o en la raíz del proyecto).
3. El script detectará automáticamente el puerto COM de tu ESP32 (filtrando dispositivos Bluetooth) y grabará los binarios precompilados (`bootloader`, `partitions`, `boot_app0` y `cayetino_esp32.ino.bin`) a 921600 baudios.
4. ¡Listo! El ESP32 se reiniciará automáticamente y quedará preparado para conectarse por Web Serial.

> *Nota: Si tu placa ESP32 no tiene circuito de auto-reset por capacitor, mantén presionado el botón **BOOT** durante 1 segundo cuando aparezca "Connecting...".*

### Opción 2: Mediante Arduino IDE
1. Abre Arduino IDE y abre `cayetino_esp32/cayetino_esp32.ino`.
2. En **Herramientas -> Placa -> esp32**, selecciona **DOIT ESP32 DEVKIT V1** o **ESP32 Dev Module**.
3. En **Herramientas -> Puerto**, selecciona el puerto COM de tu ESP32 (por ejemplo, `COM7`).
4. En **Herramientas -> Upload Speed**, selecciona **921600**.
5. Presiona el botón **Subir**.

## Circuito de Conexión Recomendado
- **Osciloscopio / Adquisición Directa**:
  - `GPIO 25` -> Canal 1 (+)
  - `GND` -> Referencia Tierra (-)
- **Amplificador Biomédico (AD620 / INA128)**:
  - Ver diagrama en pestaña *Hardware & Guía Biomédica* de la app Streamlit con divisor resistivo para atenuar a milivoltios ($1 - 3\text{ mV}$).
