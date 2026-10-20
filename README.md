# ⚡ CAYETINO 2 — Generador de Señales Biomédicas ESP32 (JavaScript & Web Serial)

Plataforma web de última generación para la síntesis, diseño, carga y emisión analógica continua de biopotenciales (**EKG, EMG, EEG, RSP, PPG**) y formas de onda periódicas en microcontroladores **ESP32** utilizando la **Web Serial API** y almacenamiento no volátil **LittleFS**.

![](./imgs/Screenshot%202026-10-19%20231729.png)

Diseñado para ejecutarse 100% en el navegador y alojarse directamente en **GitHub Pages**, sin necesidad de instalar Python, controladores adicionales o servidores backend.

---

## 🌟 Características Principales

- **Conexión Directa por Web Serial**: Comunícate directamente con tu placa ESP32 desde el navegador (Google Chrome, Microsoft Edge, Opera).
- **Diseño Estético Blanco Luminoso de Alto Impacto**: Interfaz de usuario pulida, moderna, de grado médico y minimalista, optimizada con animaciones suaves, indicadores LED en tiempo real y gráficos de alta velocidad a 60 FPS con Chart.js.
- **Modo Simulación Virtual**: Prueba toda la plataforma y simula el almacenamiento en LittleFS y la reproducción analógica sin necesidad de conectar hardware físico.
- **📊 Modo Básico (Ondas Periódicas)**: Genera ondas Senoidales, Cuadradas (con ciclo de trabajo ajustable), Triangulares, Dientes de Sierra y Dientes de Sierra Invertidas.
- **🧬 Modo Avanzado (Biomédico & Ruido)**:
  - Síntesis de **EKG** (Electrocardiograma con ritmo BPM y dinámica PQRST fisiológica).
  - Síntesis de **EMG** (Electromiografía con ráfagas de activación muscular).
  - Síntesis de **EEG** (Electroencefalograma con ritmos Alpha, Beta, Theta y componente 1/f).
  - Síntesis de **RSP** (Respiración asimétrica) y **PPG** (Fotopletismografía de pulso).
  - **Inyección de Ruido Clínico**: Interferencia electromagnética de red (60 Hz / 50 Hz), ruido térmico Gaussiano y artefactos impulsionales de movimiento (spikes).
  - **Análisis Espectral (FFT)**: Densidad espectral de potencia en tiempo real para visualizar armónicos y frecuencias contaminantes.
- **📂 Carga de Archivos de Señal Externos**: Arrastra y suelta tus propios archivos `.csv`, `.txt` o `.dat` (como registros de PhysioNet o capturas de osciloscopio). El motor cuantiza automáticamente la señal a 8 bits (0-255) y te permite **transferirla a la memoria Flash del ESP32** y **reproducirla por el DAC con un solo clic**.
- **💾 Gestor LittleFS & Control DAC**:
  - Lista de archivos grabados en memoria Flash con Fs, cantidad de muestras, duración y tamaño ocupado.
  - Botón **▶️ REPRODUCIR (PLAY)**: Carga el archivo en RAM del ESP32 e inicia la emisión analógica ininterrumpida por hardware (`esp_timer`).
  - Botón **⏹️ DETENER (STOP)**: Detiene el DAC y coloca la salida en nivel seguro de reposo (~1.65 V).
  - Botón **🗑️ Eliminar**: Borra el archivo de LittleFS.
  - Botón **🧪 Autodiagnóstico Seno 5 Hz**: Emite una onda de 5 Hz generada internamente en la RAM del ESP32 sin leer archivos de memoria.
  - Selector de pin DAC activo: `GPIO 25` (DAC 1) o `GPIO 26` (DAC 2).
- **🔌 Guía de Hardware & Circuito Atenuador**: Incluye diagrama esquemático del divisor resistivo pasivo 1:1000 ($10\text{ k}\Omega$ / $10\,\Omega$) para conectar el ESP32 a electrocardiógrafos o amplificadores AD620 sin saturarlos.

---

## 🚀 Despliegue en GitHub Pages

Para correr esta aplicación directamente en la nube de GitHub con Web Serial:

1. **Crea un repositorio en GitHub** (ejemplo: `cayetino2`).
2. Sube todos los archivos de esta carpeta (`e:\PROJECTS\CAYETINO2`) a la rama principal (`main`):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Cayetino 2 Web Serial"
   git branch -M main
   git remote add origin https://github.com/<TU_USUARIO>/<TU_REPOSITORIO>.git
   git push -u origin main
   ```
3. En tu repositorio de GitHub, ve a **Settings** > **Pages**.
4. En **Build and deployment** > **Source**, selecciona **Deploy from a branch**.
5. En **Branch**, selecciona `main` y la carpeta `/(root)`. Haz clic en **Save**.
6. En un par de minutos, tu aplicación estará disponible en:
   `https://<TU_USUARIO>.github.io/<TU_REPOSITORIO>/`

> [!NOTE]
> La **Web Serial API** requiere una conexión segura (**HTTPS**). GitHub Pages proporciona HTTPS automáticamente de forma gratuita, por lo que la conexión con el ESP32 funcionará de manera nativa.

---

## 💻 Ejecución Local en tu PC con UV

Puedes levantar el servidor local de desarrollo ultra-rápido utilizando **Astral `uv`**:

### Opción 1: Con comando directo de `uv`
Desde la carpeta del proyecto `e:\PROJECTS\CAYETINO2`:
```powershell
uv run run_server.py
```
O también:
```powershell
uv run python -m http.server 8000
```
> El script [run_server.py](file:///e:/PROJECTS/CAYETINO2/run_server.py) iniciará el servidor en `http://localhost:8000`, abrirá automáticamente tu navegador web y añadirá cabeceras anti-caché y CORS para una experiencia fluida.

### Opción 2: Con el lanzador automático .BAT
Haz doble clic en el archivo [run_local.bat](file:///e:/PROJECTS/CAYETINO2/run_local.bat). Detectará automáticamente `uv` en tu sistema y levantará el servidor al instante.

---

## 🛠️ Flasheo del Firmware en el ESP32

Tienes dos formas de grabar el firmware en tu ESP32:

### Opción 1: Flasheo Automático con 1 Clic (Recomendado)
No necesitas abrir Arduino IDE ni compilar nada:
1. Conecta tu ESP32 por USB.
2. Haz doble clic en [flash_esp32.bat](file:///e:/PROJECTS/CAYETINO2/flash_esp32.bat) (en la raíz del proyecto o en `firmware/flash_esp32.bat`).
3. El script detectará automáticamente el puerto COM físico (filtrando dispositivos Bluetooth) y grabará los binarios precompilados a 921600 baudios.

### Opción 2: Desde Arduino IDE
1. Abre el archivo [`firmware/cayetino_esp32.ino`](firmware/cayetino_esp32.ino) en **Arduino IDE**.
2. Conecta tu ESP32 por USB.
3. En **Herramientas (Tools)**:
   - **Placa**: *DOIT ESP32 DEVKIT V1* o *ESP32 Dev Module*
   - **Upload Speed**: *921600*
   - **Puerto**: Selecciona el puerto COM de tu ESP32.
4. Haz clic en **Subir (Upload)**.

---

## 🔌 Circuito Atenuador Biomédico (1:1000)

Las señales biológicas reales tienen amplitudes en el orden de los milivoltios ($1\text{ mV} - 3\text{ mV}$). Debido a que el DAC del ESP32 entrega una tensión de $0.0\text{ V}$ a $3.3\text{ V}$, se debe colocar un divisor resistivo simple antes de ingresar a un amplificador de instrumentación (ej. AD620):

```text
ESP32 GPIO 25 (0 - 3.3V)
       │
      ┌┴┐
      │ │  R1 = 10 kΩ (10,000 Ω)
      └┬┘
       │
       ├───────────────────> Salida Atenuada (+) hacia electrodo EKG / AD620 [~ 3.3 mV]
       │
      ┌┴┐
      │ │  R2 = 10 Ω
      └┬┘
       │
ESP32 GND ─────────────────> Tierra de Referencia (-) GND
```

**Cálculo de Tensión:**
$$V_{out} = V_{DAC} \times \frac{R_2}{R_1 + R_2} = 3.3\text{ V} \times \frac{10}{10010} \approx 3.3\text{ mV}$$

---

## 📋 Protocolo Serial Cayetino

| Comando Serial | Parámetros | Respuesta ESP32 | Descripción |
| :--- | :--- | :--- | :--- |
| `PING` | Ninguno | `PONG:CAYETINO_ESP32_OK` | Comprueba conexión con el firmware. |
| `LIST` | Ninguno | `FILES_START` ... `FILES_END` | Lista los archivos grabados en LittleFS. |
| `SAVE_START:<name>:<fs>:<n>` | Nombre, Fs, muestras | `READY_CHUNKS` | Prepara archivo en LittleFS para escritura. |
| `CHUNK:<v1,v2,...>` | Muestras 8-bit | `ACK_CHUNK` | Transmisión por bloques con control de flujo. |
| `SAVE_END` | Ninguno | `OK_SAVE:<name>:<n>` | Cierra el archivo y confirma guardado. |
| `PLAY:<name>` | Nombre del archivo | `OK_PLAY:<name>:<fs>:<n>` | Inicia la emisión continua por DAC en bucle. |
| `STOP` | Ninguno | `OK_STOP` | Detiene el DAC y coloca la salida en nivel neutro (~1.65V). |
| `STATUS` | Ninguno | `STATUS:PLAYING:...` o `STATUS:IDLE` | Consulta en vivo el estado del generador. |
| `DELETE:<name>` | Nombre de archivo | `OK_DELETE:<name>` | Borra el archivo de LittleFS. |
| `FORMAT` | Ninguno | `OK_FORMAT` | Formatea el sistema de archivos Flash. |
| `SET_DAC_PIN:<pin>` | Pin (25 o 26) | `OK_DAC_PIN:<pin>` | Cambia el pin de salida analógica. |
| `TEST_SINE` | Ninguno | `OK_TEST_SINE:<fs>:<samples>` | Activa onda senoidal pura de 5 Hz para autodiagnóstico. |

---

## 📁 Estructura del Proyecto

```text
CAYETINO2/
├── index.html              # Aplicación web completa de una sola página
├── css/
│   └── style.css          # Tema estético blanco luminoso de alto impacto
├── js/
│   ├── signal.js          # Motor de síntesis fisiológica, ruido, FFT y DAC
│   ├── serial.js          # Controlador Web Serial y simulador virtual
│   └── app.js             # Lógica de interfaz, eventos y gráficos Chart.js
├── firmware/
│   ├── cayetino_esp32.ino # Sketch Arduino en C++ para ESP32
│   └── README.md          # Instrucciones de compilación
├── samples/
│   ├── ejemplo_ekg_lead_II.csv  # Muestra de electrocardiograma (250 Hz)
│   ├── ejemplo_emg_biceps.csv   # Muestra de electromiografía con ráfagas (1000 Hz)
│   └── ejemplo_seno_10hz.txt    # Muestra senoidal pura de 10 Hz (500 Hz)
├── run_local.bat          # Lanzador de servidor local
├── .nojekyll              # Configuración para GitHub Pages
└── README.md              # Documentación oficial
```
