/**
 * ============================================================================
 * PROYECTO CAYETINO - GESTOR DE COMUNICACIÓN WEB SERIAL CON ESP32 (serial.js)
 * Conexión nativa con navigator.serial y simulador virtual integrado
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CayetinoSerialClient = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Lista de filtros de dispositivos USB-UART físicos para ESP32 y microcontroladores
  // Excluye automáticamente puertos virtuales de Bluetooth (BITalino, RFCOMM, etc.)
  const USB_DEVICE_FILTERS = [
    // 1. Silicon Labs CP210x (CP2102, CP2104, CP2102N) - El más común en placas ESP32 DevKit
    { usbVendorId: 0x10C4 },
    // 2. WCH QinHeng (CH340, CH341, CH342, CH343, CH9102) - Muy extendido en placas de desarrollo
    { usbVendorId: 0x1A86 },
    // 3. Espressif Systems (ESP32-S2, ESP32-S3, ESP32-C3, ESP32-C6 USB-JTAG / CDC nativo)
    { usbVendorId: 0x303A },
    // 4. FTDI (FT232R, FT232H, FT2232H, FT4232H, FT230X)
    { usbVendorId: 0x0403 },
    // 5. Prolific Technology (PL2303)
    { usbVendorId: 0x067B },
    // 6. Raspberry Pi Foundation (RP2040, Pico Serial)
    { usbVendorId: 0x2E8A },
    // 7. Arduino Oficial
    { usbVendorId: 0x2341 },
    // 8. STMicroelectronics (Virtual COM Port)
    { usbVendorId: 0x0483 },
    // 9. Microchip / Atmel Corp.
    { usbVendorId: 0x04D8 },
    { usbVendorId: 0x03EB }
  ];

  class CayetinoSerialClient {
    constructor() {
      this.simulationMode = false;
      this.isConnected = false;
      this.port = null;
      this.reader = null;
      this.baudRate = 115200;
      this.portInfo = '';

      // Control de líneas recibidas
      this.lineBuffer = '';
      this.lineListeners = [];
      this.rawLogs = [];
      this.onLogCallback = null;

      // Estado en modo simulación
      this.simFiles = {
        'demo_ekg_normal.csv': {
          name: 'demo_ekg_normal.csv',
          fs: 250,
          samples: 1250,
          duration: 5.0,
          sizeBytes: 15400
        },
        'demo_seno_10hz.txt': {
          name: 'demo_seno_10hz.txt',
          fs: 500,
          samples: 1000,
          duration: 2.0,
          sizeBytes: 8500
        },
        'demo_emg_bursts.csv': {
          name: 'demo_emg_bursts.csv',
          fs: 1000,
          samples: 3000,
          duration: 3.0,
          sizeBytes: 36800
        }
      };
      this.simStatus = { playing: false, filename: '', fs: 0, dacPin: 25 };
      this.activeDacPin = 25;
    }

    /**
     * Comprueba si el navegador soporta Web Serial API
     */
    static isWebSerialSupported() {
      return typeof navigator !== 'undefined' && 'serial' in navigator;
    }

    log(msg, type = 'info') {
      const timeStr = new Date().toLocaleTimeString();
      const logEntry = { time: timeStr, msg, type };
      this.rawLogs.push(logEntry);
      if (this.rawLogs.length > 200) this.rawLogs.shift();
      if (typeof this.onLogCallback === 'function') {
        this.onLogCallback(logEntry);
      }
    }

    /**
     * Solicita al usuario elegir un puerto COM y se conecta.
     * Permite filtrar para mostrar ÚNICAMENTE puertos USB físicos (oculta Bluetooth).
     */
    async requestAndConnect(baudRate = 115200, filterUsbOnly = true) {
      if (this.simulationMode) {
        this.isConnected = true;
        this.portInfo = 'Virtual ESP32 (Simulado en Navegador)';
        this.baudRate = baudRate;
        this.log('Conectado en Modo Simulación Virtual.', 'success');
        return true;
      }

      if (!CayetinoSerialClient.isWebSerialSupported()) {
        throw new Error(
          'Web Serial API no es compatible con este navegador. Por favor utiliza Google Chrome, Microsoft Edge u Opera, o activa el Modo Simulación.'
        );
      }

      try {
        this.log(filterUsbOnly ? 'Buscando puertos COM USB físicos (ocultando Bluetooth)...' : 'Buscando todos los puertos seriales...', 'info');
        const reqOptions = filterUsbOnly ? { filters: USB_DEVICE_FILTERS } : {};
        const port = await navigator.serial.requestPort(reqOptions);
        return await this.connectPort(port, baudRate);
      } catch (err) {
        if (err.name === 'NotFoundError') {
          this.log('Selección de puerto cancelada por el usuario.', 'warn');
          return false;
        }
        this.log(`Error al conectar: ${err.message}`, 'error');
        throw err;
      }
    }

    /**
     * Abre un puerto Serial específico
     */
    async connectPort(port, baudRate = 115200) {
      await this.disconnect();

      this.port = port;
      this.baudRate = baudRate;

      try {
        this.log(`Abriendo puerto a ${baudRate} baudios...`, 'info');
        await this.port.open({
          baudRate: parseInt(baudRate, 10),
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });

        this.isConnected = true;
        const info = port.getInfo ? port.getInfo() : {};
        this.portInfo = `USB Serial (VID: ${info.usbVendorId || 'N/A'}, PID: ${info.usbProductId || 'N/A'})`;

        // Iniciar loop de lectura continua
        this._startReadLoop();

        // Breve espera de estabilización DTR/RTS
        await new Promise((r) => setTimeout(r, 600));

        // Enviar PING de comprobación
        this.log('Comprobando enlace con PING...', 'info');
        const isOk = await this.ping();
        if (isOk) {
          this.log('¡Enlace establecido con éxito con firmware Cayetino!', 'success');
        } else {
          this.log('Aviso: El ESP32 no respondió a PING inmediatamente (puede estar arrancando o ejecutando otro sketch).', 'warn');
        }

        return true;
      } catch (err) {
        this.log(`Fallo al abrir puerto: ${err.message}`, 'error');
        await this.disconnect();
        throw err;
      }
    }

    /**
     * Bucle asíncrono de lectura del flujo Serial
     */
    async _startReadLoop() {
      const decoder = new TextDecoder();
      try {
        while (this.port && this.port.readable && this.isConnected) {
          this.reader = this.port.readable.getReader();
          try {
            while (true) {
              const { value, done } = await this.reader.read();
              if (done) break;
              if (value) {
                const chunkStr = decoder.decode(value, { stream: true });
                this.lineBuffer += chunkStr;
                const lines = this.lineBuffer.split('\n');
                // Dejar en el buffer el residuo incompleto
                this.lineBuffer = lines.pop();

                for (const line of lines) {
                  const clean = line.replace('\r', '').trim();
                  if (clean.length > 0) {
                    this._dispatchLine(clean);
                  }
                }
              }
            }
          } catch (readErr) {
            if (this.isConnected) {
              console.warn('Error en lectura Serial:', readErr);
            }
          } finally {
            if (this.reader) {
              this.reader.releaseLock();
              this.reader = null;
            }
          }
        }
      } catch (err) {
        if (this.isConnected) {
          console.error('Error en loop lector:', err);
        }
      }
    }

    /**
     * Distribuye la línea a los escuchas que esperan respuesta
     */
    _dispatchLine(line) {
      // Registrar log si no es CHUNK de datos masivos
      if (!line.startsWith('CHUNK') && !line.startsWith('ACK_CHUNK')) {
        this.log(`<< ${line}`, 'rx');
      }

      // Notificar listeners registrados
      for (let i = this.lineListeners.length - 1; i >= 0; i--) {
        const listener = this.lineListeners[i];
        const handled = listener(line);
        if (handled) {
          this.lineListeners.splice(i, 1);
        }
      }
    }

    /**
     * Espera por una línea que cumpla cierta condición con timeout
     */
    waitForLine(predicate, timeoutMs = 3000) {
      return new Promise((resolve, reject) => {
        let timer = null;

        const listener = (line) => {
          try {
            if (predicate(line)) {
              if (timer) clearTimeout(timer);
              resolve(line);
              return true; // handled
            }
          } catch (e) {
            if (timer) clearTimeout(timer);
            reject(e);
            return true;
          }
          return false;
        };

        this.lineListeners.push(listener);

        timer = setTimeout(() => {
          // Remover listener si expiró
          const idx = this.lineListeners.indexOf(listener);
          if (idx !== -1) this.lineListeners.splice(idx, 1);
          reject(new Error(`Timeout (${timeoutMs} ms) esperando respuesta del ESP32.`));
        }, timeoutMs);
      });
    }

    /**
     * Envía un comando por Serial
     */
    async writeCommand(cmd) {
      if (!this.isConnected) {
        throw new Error('ESP32 no está conectado.');
      }

      const fullCmd = cmd.trim() + '\n';
      if (!cmd.startsWith('CHUNK')) {
        this.log(`>> ${cmd.trim()}`, 'tx');
      }

      if (this.simulationMode) {
        return;
      }

      if (!this.port || !this.port.writable) {
        throw new Error('El puerto Serial no es escribible.');
      }

      const writer = this.port.writable.getWriter();
      try {
        const encoder = new TextEncoder();
        await writer.write(encoder.encode(fullCmd));
      } finally {
        writer.releaseLock();
      }
    }

    /**
     * Cierra la conexión
     */
    async disconnect() {
      this.isConnected = false;
      this.lineListeners = [];
      this.lineBuffer = '';

      if (this.reader) {
        try {
          await this.reader.cancel();
        } catch (e) {}
        this.reader = null;
      }

      if (this.port) {
        try {
          await this.port.close();
        } catch (e) {}
        this.port = null;
      }

      this.log('Desconectado del ESP32.', 'info');
    }

    /**
     * 1. PING: Comprueba comunicación con el ESP32
     */
    async ping() {
      if (this.simulationMode) return true;
      if (!this.isConnected) return false;

      try {
        const waitPromise = this.waitForLine(
          (line) => line.includes('PONG') || line.includes('CAYETINO'),
          1500
        );
        await this.writeCommand('PING');
        await waitPromise;
        return true;
      } catch (e) {
        // Segundo intento de rescate
        try {
          const retryPromise = this.waitForLine(
            (line) => line.includes('PONG') || line.includes('CAYETINO'),
            1500
          );
          await this.writeCommand('PING');
          await retryPromise;
          return true;
        } catch (err2) {
          return false;
        }
      }
    }

    /**
     * 2. LIST: Consulta lista de archivos en LittleFS
     */
    async listFiles() {
      if (this.simulationMode) {
        return Object.values(this.simFiles);
      }

      if (!this.isConnected) return [];

      const files = [];
      let inList = false;

      return new Promise(async (resolve, reject) => {
        let timer = null;

        const listener = (line) => {
          if (line.includes('FILES_START')) {
            inList = true;
            return false;
          }
          if (line.includes('FILES_END')) {
            if (timer) clearTimeout(timer);
            const idx = this.lineListeners.indexOf(listener);
            if (idx !== -1) this.lineListeners.splice(idx, 1);
            resolve(files);
            return true;
          }
          if (inList && line.startsWith('FILE:')) {
            // Formato: FILE:<nombre>:<fs>:<samples>:<bytes>
            const parts = line.split(':');
            if (parts.length >= 5) {
              const name = parts[1].replace(/^\//, '');
              const fs = parseInt(parts[2], 10) || 250;
              const samples = parseInt(parts[3], 10) || 0;
              const sizeBytes = parseInt(parts[4], 10) || 0;
              const duration = fs > 0 ? Math.round((samples / fs) * 100) / 100 : 0.0;
              files.push({ name, fs, samples, duration, sizeBytes });
            }
          }
          return false;
        };

        this.lineListeners.push(listener);

        timer = setTimeout(() => {
          const idx = this.lineListeners.indexOf(listener);
          if (idx !== -1) this.lineListeners.splice(idx, 1);
          resolve(files); // Retorna lo que haya capturado
        }, 4000);

        try {
          await this.writeCommand('LIST');
        } catch (e) {
          if (timer) clearTimeout(timer);
          reject(e);
        }
      });
    }

    /**
     * 3. SAVE_FILE: Graba señal en LittleFS por bloques (Chunks) con ACK
     */
    async saveFile(filename, fs, dacValues, chunkSize = 64, onProgress = null) {
      const cleanName = filename.trim().replace(/^\//, '');
      const numSamples = dacValues.length;

      if (this.simulationMode) {
        // Simulación visual de envío fluido
        const steps = Math.ceil(numSamples / chunkSize);
        for (let i = 0; i < steps; i++) {
          await new Promise((r) => setTimeout(r, 15));
          if (onProgress) {
            onProgress(Math.min(1.0, ((i + 1) * chunkSize) / numSamples));
          }
        }
        this.simFiles[cleanName] = {
          name: cleanName,
          fs: fs,
          samples: numSamples,
          duration: Math.round((numSamples / fs) * 100) / 100,
          sizeBytes: numSamples * 4
        };
        this.log(`Archivo virtual '${cleanName}' guardado en LittleFS simulado.`, 'success');
        return true;
      }

      if (!this.isConnected) {
        throw new Error('ESP32 desconectado.');
      }

      // 1. Iniciar guardado
      this.log(`Iniciando guardado de '${cleanName}' (${numSamples} muestras @ ${fs} Hz)...`, 'info');
      const startCmd = `SAVE_START:${cleanName}:${fs}:${numSamples}`;
      const readyPromise = this.waitForLine((line) => line.includes('READY_CHUNKS'), 3500);
      await this.writeCommand(startCmd);
      await readyPromise;

      // 2. Enviar chunks con espera estricta de ACK_CHUNK
      for (let i = 0; i < numSamples; i += chunkSize) {
        const slice = dacValues.subarray ? dacValues.subarray(i, i + chunkSize) : dacValues.slice(i, i + chunkSize);
        const chunkCsv = Array.from(slice).join(',');
        const chunkCmd = `CHUNK:${chunkCsv}`;

        const ackPromise = this.waitForLine(
          (line) => line.includes('ACK_CHUNK') || line.includes('ERR_CHUNK'),
          2500
        );

        await this.writeCommand(chunkCmd);
        const ackLine = await ackPromise;
        if (ackLine.includes('ERR_CHUNK')) {
          throw new Error(`Error en ESP32 al procesar bloque: ${ackLine}`);
        }

        if (onProgress) {
          const ratio = Math.min(0.96, (i + chunkSize) / numSamples);
          onProgress(ratio);
        }
      }

      // 3. Finalizar guardado
      const okSavePromise = this.waitForLine((line) => line.includes('OK_SAVE'), 4000);
      await this.writeCommand('SAVE_END');
      const saveRes = await okSavePromise;

      if (onProgress) onProgress(1.0);
      this.log(`¡Archivo '${cleanName}' guardado con éxito! (${saveRes})`, 'success');
      return true;
    }

    /**
     * 4. PLAY: Inicia la reproducción analógica DAC de un archivo
     */
    async playFile(filename) {
      const cleanName = filename.trim().replace(/^\//, '');

      if (this.simulationMode) {
        if (this.simFiles[cleanName]) {
          const f = this.simFiles[cleanName];
          this.simStatus = { playing: true, filename: cleanName, fs: f.fs, samples: f.samples, dacPin: this.activeDacPin };
          this.log(`Reproduciendo virtualmente '${cleanName}' a ${f.fs} Hz por DAC GPIO ${this.activeDacPin}.`, 'success');
          return { success: true, filename: cleanName, fs: f.fs, samples: f.samples };
        }
        return { success: false, error: 'Archivo no encontrado en simulación.' };
      }

      if (!this.isConnected) {
        return { success: false, error: 'ESP32 no conectado.' };
      }

      try {
        const playPromise = this.waitForLine(
          (line) => line.includes('OK_PLAY') || line.includes('ERR_PLAY'),
          4500
        );
        await this.writeCommand(`PLAY:${cleanName}`);
        const resLine = await playPromise;

        if (resLine.includes('OK_PLAY:')) {
          const parts = resLine.split(':');
          const fs = parseInt(parts[2], 10) || 250;
          const samples = parseInt(parts[3], 10) || 0;
          this.simStatus = { playing: true, filename: cleanName, fs, samples, dacPin: this.activeDacPin };
          this.log(`¡DAC activo reproduciendo '${cleanName}' (${samples} muestras @ ${fs} Hz)!`, 'success');
          return { success: true, filename: cleanName, fs, samples };
        } else {
          this.log(`Fallo en reproducción: ${resLine}`, 'error');
          return { success: false, error: resLine };
        }
      } catch (err) {
        this.log(`Timeout en PLAY: ${err.message}`, 'error');
        return { success: false, error: err.message };
      }
    }

    /**
     * 5. STOP: Detiene la reproducción DAC y deja nivel en reposo (~1.65 V)
     */
    async stopPlayback() {
      if (this.simulationMode) {
        this.simStatus.playing = false;
        this.log('Reproducción virtual detenida. DAC en reposo.', 'info');
        return true;
      }

      if (!this.isConnected) return false;

      try {
        const stopPromise = this.waitForLine((line) => line.includes('OK_STOP'), 2000);
        await this.writeCommand('STOP');
        await stopPromise;
        this.simStatus.playing = false;
        this.log('Reproducción DAC detenida. Salida en nivel neutro (128 = ~1.65V).', 'info');
        return true;
      } catch (err) {
        this.log(`Aviso al detener: ${err.message}`, 'warn');
        return false;
      }
    }

    /**
     * 6. TEST_SINE: Prueba de hardware rápida (5 Hz senoidal directa de RAM)
     */
    async playTestSine() {
      if (this.simulationMode) {
        this.simStatus = { playing: true, filename: 'TEST_SENO_5HZ', fs: 500, samples: 100, dacPin: this.activeDacPin };
        this.log('Prueba senoidal de 5 Hz activada (Modo Simulación).', 'success');
        return { success: true, filename: 'TEST_SENO_5HZ', fs: 500, samples: 100 };
      }

      if (!this.isConnected) {
        return { success: false, error: 'ESP32 no conectado.' };
      }

      try {
        const testPromise = this.waitForLine(
          (line) => line.includes('OK_TEST_SINE') || line.includes('ERR_TEST'),
          3000
        );
        await this.writeCommand('TEST_SINE');
        const resLine = await testPromise;

        if (resLine.includes('OK_TEST_SINE:')) {
          const parts = resLine.split(':');
          const fs = parseInt(parts[1], 10) || 500;
          const samples = parseInt(parts[2], 10) || 100;
          this.simStatus = { playing: true, filename: 'TEST_SENO_5HZ', fs, samples, dacPin: this.activeDacPin };
          this.log(`Señal de autodiagnóstico de 5 Hz activada por hardware DAC!`, 'success');
          return { success: true, filename: 'TEST_SENO_5HZ', fs, samples };
        } else {
          return { success: false, error: resLine };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    /**
     * 7. STATUS: Consulta estado actual en vivo
     */
    async getStatus() {
      if (this.simulationMode) {
        return { ...this.simStatus };
      }

      if (!this.isConnected) {
        return { playing: false, filename: '', fs: 0, dacPin: this.activeDacPin };
      }

      try {
        const statPromise = this.waitForLine((line) => line.startsWith('STATUS:'), 1500);
        await this.writeCommand('STATUS');
        const res = await statPromise;

        if (res.startsWith('STATUS:PLAYING:')) {
          const parts = res.split(':');
          const filename = parts[2] ? parts[2].replace(/^\//, '') : '';
          const fs = parseInt(parts[3], 10) || 0;
          const samples = parseInt(parts[4], 10) || 0;
          this.simStatus = { playing: true, filename, fs, samples, dacPin: this.activeDacPin };
          return { playing: true, filename, fs, samples, dacPin: this.activeDacPin };
        } else if (res.includes('STATUS:IDLE')) {
          this.simStatus = { playing: false, filename: '', fs: 0, dacPin: this.activeDacPin };
          return { playing: false, filename: '', fs: 0, dacPin: this.activeDacPin };
        }
      } catch (err) {
        // Fallback silencioso en polling
      }

      return { playing: false, filename: '', fs: 0, dacPin: this.activeDacPin };
    }

    /**
     * 8. DELETE: Borra un archivo de LittleFS
     */
    async deleteFile(filename) {
      const cleanName = filename.trim().replace(/^\//, '');

      if (this.simulationMode) {
        delete this.simFiles[cleanName];
        if (this.simStatus.filename === cleanName) {
          this.simStatus.playing = false;
        }
        this.log(`Archivo virtual '${cleanName}' eliminado.`, 'info');
        return true;
      }

      if (!this.isConnected) return false;

      try {
        const delPromise = this.waitForLine(
          (line) => line.includes('OK_DELETE') || line.includes('ERR_DELETE'),
          2500
        );
        await this.writeCommand(`DELETE:${cleanName}`);
        const res = await delPromise;
        const ok = res.includes('OK_DELETE');
        if (ok) {
          this.log(`Archivo '${cleanName}' eliminado de LittleFS.`, 'info');
        } else {
          this.log(`Error al eliminar: ${res}`, 'error');
        }
        return ok;
      } catch (err) {
        this.log(`Timeout al borrar archivo: ${err.message}`, 'error');
        return false;
      }
    }

    /**
     * 9. FORMAT: Formatea LittleFS
     */
    async formatFS() {
      if (this.simulationMode) {
        this.simFiles = {};
        this.simStatus = { playing: false, filename: '', fs: 0, dacPin: this.activeDacPin };
        this.log('Sistema de archivos virtual formateado.', 'info');
        return true;
      }

      if (!this.isConnected) return false;

      try {
        this.log('Formateando memoria Flash LittleFS del ESP32 (puede tardar unos segundos)...', 'warn');
        const fmtPromise = this.waitForLine((line) => line.includes('OK_FORMAT'), 10000);
        await this.writeCommand('FORMAT');
        await fmtPromise;
        this.log('¡Memoria Flash formateada exitosamente!', 'success');
        return true;
      } catch (err) {
        this.log(`Error al formatear: ${err.message}`, 'error');
        return false;
      }
    }

    /**
     * 10. SET_DAC_PIN: Configura el pin DAC activo (25 o 26)
     */
    async setDacPin(pin) {
      const pinNum = parseInt(pin, 10);
      if (pinNum !== 25 && pinNum !== 26) {
        throw new Error('Solo se admiten los pines DAC 25 o 26.');
      }

      this.activeDacPin = pinNum;
      this.simStatus.dacPin = pinNum;

      if (this.simulationMode) {
        this.log(`Pin DAC configurado en GPIO ${pinNum} (Modo Simulación).`, 'info');
        return true;
      }

      if (!this.isConnected) return false;

      try {
        const pinPromise = this.waitForLine((line) => line.includes('OK_DAC_PIN'), 2000);
        await this.writeCommand(`SET_DAC_PIN:${pinNum}`);
        await pinPromise;
        this.log(`Pin DAC analógico configurado en GPIO ${pinNum}.`, 'success');
        return true;
      } catch (err) {
        this.log(`Aviso al configurar pin DAC: ${err.message}`, 'warn');
        return false;
      }
    }
  }

  return CayetinoSerialClient;
});
