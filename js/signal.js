/**
 * ============================================================================
 * PROYECTO CAYETINO - MOTOR DE GENERACIÓN Y ANÁLISIS DE SEÑALES (signal.js)
 * Síntesis de ondas periódicas, modelos fisiológicos (EKG, EMG, EEG, RSP, PPG),
 * inyección de ruido clínico, mapeo DAC 8-bit y análisis espectral FFT.
 * ============================================================================
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CayetinoSignal = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Generador de números pseudoaleatorios con semilla (para reproducibilidad)
  class SeededRandom {
    constructor(seed = 42) {
      this.seed = seed % 2147483647;
      if (this.seed <= 0) this.seed += 2147483646;
    }
    next() {
      this.seed = (this.seed * 16807) % 2147483647;
      return (this.seed - 1) / 2147483646;
    }
    gaussian(mean = 0, std = 1) {
      let u = 0, v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      return mean + z * std;
    }
  }

  /**
   * 1. GENERADOR DE FORMAS DE ONDA BÁSICAS
   */
  function generateBasicSignal({
    type = 'senoidal',
    freq = 5.0,
    fs = 500,
    duration = 2.0,
    amplitude = 1.0,
    offset = 0.0,
    dutyCycle = 0.5
  }) {
    const nSamples = Math.max(10, Math.round(fs * duration));
    const t = new Float64Array(nSamples);
    const y = new Float64Array(nSamples);
    const dt = 1.0 / fs;

    const typeClean = (type || 'senoidal').toLowerCase().trim();

    for (let i = 0; i < nSamples; i++) {
      const time = i * dt;
      t[i] = time;
      const phase = (time * freq) % 1.0;
      const normalizedPhase = phase < 0 ? phase + 1.0 : phase;

      let val = 0.0;
      switch (typeClean) {
        case 'senoidal':
        case 'seno':
        case 'sine':
          val = Math.sin(2.0 * Math.PI * freq * time);
          break;

        case 'cuadrada':
        case 'square':
          val = normalizedPhase < dutyCycle ? 1.0 : -1.0;
          break;

        case 'triangulo':
        case 'triangular':
        case 'triangle':
          // Onda triangular simétrica de -1 a 1
          if (normalizedPhase < 0.5) {
            val = 4.0 * normalizedPhase - 1.0;
          } else {
            val = 3.0 - 4.0 * normalizedPhase;
          }
          break;

        case 'diente_sierra':
        case 'sawtooth':
          // Rampa ascendente de -1 a 1
          val = 2.0 * normalizedPhase - 1.0;
          break;

        case 'diente_sierra_inv':
        case 'inverted_sawtooth':
          // Rampa descendente de 1 a -1
          val = 1.0 - 2.0 * normalizedPhase;
          break;

        default:
          val = Math.sin(2.0 * Math.PI * freq * time);
          break;
      }

      y[i] = amplitude * val + offset;
    }

    return { t, y, nSamples, fs, duration };
  }

  /**
   * 2. GENERADOR DE SEÑALES BIOMÉDICAS SINTÉTICAS
   */
  function generateBiomedicalSignal({
    type = 'ekg',
    fs = 250,
    duration = 5.0,
    heartRate = 72,
    burstNumber = 3,
    burstDuration = 0.6,
    seed = 42
  }) {
    const nSamples = Math.max(10, Math.round(fs * duration));
    const t = new Float64Array(nSamples);
    const y = new Float64Array(nSamples);
    const dt = 1.0 / fs;
    for (let i = 0; i < nSamples; i++) {
      t[i] = i * dt;
    }

    const rng = new SeededRandom(seed);
    const bioClean = (type || 'ekg').toLowerCase().trim();

    if (bioClean === 'ekg' || bioClean === 'ecg') {
      // Síntesis fisiológica de ECG: suma de ondas gaussianas para P, Q, R, S, T
      // con modulación de variabilidad y deriva de línea base suave
      const rrInterval = 60.0 / heartRate; // Período cardíaco en segundos

      // Parámetros relativos al ciclo PQRST (amplitud, ancho b, posición relativa)
      // Basado en el modelo clásico de McSharry / Clifford
      const waves = [
        { name: 'P', a: 0.22, b: 0.045, theta: -0.20 },
        { name: 'Q', a: -0.18, b: 0.022, theta: -0.06 },
        { name: 'R', a: 1.35, b: 0.030, theta: 0.00 },
        { name: 'S', a: -0.38, b: 0.028, theta: 0.06 },
        { name: 'T', a: 0.32, b: 0.090, theta: 0.25 },
        { name: 'U', a: 0.04, b: 0.050, theta: 0.40 }
      ];

      for (let i = 0; i < nSamples; i++) {
        const time = t[i];
        // Posición dentro del latido actual (de -0.5 a +0.5 ciclo RR)
        const beatPhase = ((time % rrInterval) / rrInterval) - 0.28;
        // Normalizar fase a [-0.5, 0.5]
        let dtPhase = beatPhase;
        while (dtPhase < -0.5) dtPhase += 1.0;
        while (dtPhase > 0.5) dtPhase -= 1.0;

        let ecgVal = 0.0;
        for (const w of waves) {
          const diff = dtPhase - w.theta;
          const exponent = -0.5 * Math.pow(diff / (w.b / rrInterval), 2);
          ecgVal += w.a * Math.exp(exponent);
        }

        // Leve componente de respiración (baseline wander < 0.2 Hz)
        const baselineWander = 0.05 * Math.sin(2.0 * Math.PI * 0.25 * time);
        y[i] = ecgVal + baselineWander;
      }
    } else if (bioClean === 'emg') {
      // Electromiografía con ráfagas (bursts) de activación muscular
      const burstInterval = duration / (burstNumber + 1);
      const activeWindows = [];
      for (let b = 1; b <= burstNumber; b++) {
        const center = b * burstInterval;
        activeWindows.push({
          start: center - burstDuration / 2,
          end: center + burstDuration / 2,
          center: center
        });
      }

      // Ruido muscular modulado por la envolvente de activación
      for (let i = 0; i < nSamples; i++) {
        const time = t[i];
        let envelope = 0.02; // Tono muscular basal en reposo

        for (const win of activeWindows) {
          if (time >= win.start && time <= win.end) {
            // Envolvente tipo Tukey / Hanning suave para la contracción
            const rel = (time - win.start) / (win.end - win.start);
            const env = Math.sin(Math.PI * rel);
            envelope = Math.max(envelope, env);
          }
        }

        // Ruido blanco Gaussiano coloreado
        const rawNoise = rng.gaussian(0, 1.0);
        y[i] = rawNoise * envelope;
      }
    } else if (bioClean === 'eeg') {
      // Electroencefalograma sintético: mezcla de bandas fisiológicas
      // Alpha (8-12 Hz), Beta (13-28 Hz), Theta (4-7 Hz), Ruido 1/f
      let pinkAcc = 0.0;
      for (let i = 0; i < nSamples; i++) {
        const time = t[i];
        const alpha = 0.45 * Math.sin(2.0 * Math.PI * 10.0 * time + 0.3);
        const beta = 0.22 * Math.sin(2.0 * Math.PI * 21.0 * time + 1.2);
        const theta = 0.35 * Math.sin(2.0 * Math.PI * 5.8 * time + 2.5);

        // Caminata aleatoria filtrada (ruido rosa / 1/f)
        pinkAcc = 0.98 * pinkAcc + 0.05 * rng.gaussian(0, 1.0);

        y[i] = alpha + beta + theta + pinkAcc;
      }
    } else if (bioClean === 'rsp' || bioClean === 'respiracion') {
      // Señal respiratoria: 15 respiraciones por minuto = 0.25 Hz
      const respFreq = 0.25;
      for (let i = 0; i < nSamples; i++) {
        const time = t[i];
        // Asimetría fisiológica: inspiración más rápida que espiración
        const phase = (time * respFreq) % 1.0;
        let respVal = 0.0;
        if (phase < 0.4) {
          respVal = Math.sin((phase / 0.4) * (Math.PI / 2.0));
        } else {
          respVal = Math.cos(((phase - 0.4) / 0.6) * (Math.PI / 2.0));
        }
        // Variabilidad suave de amplitud
        const breathMod = 1.0 + 0.08 * Math.sin(2.0 * Math.PI * 0.04 * time);
        y[i] = respVal * breathMod;
      }
    } else if (bioClean === 'ppg') {
      // Fotopletismografía / Pulso de Oximetría
      const pulseInterval = 60.0 / heartRate;
      for (let i = 0; i < nSamples; i++) {
        const time = t[i];
        const phase = (time % pulseInterval) / pulseInterval;

        // Onda sistólica principal (pico alto en ~0.18 del ciclo)
        const p1 = Math.exp(-Math.pow((phase - 0.18) / 0.08, 2)) * 1.0;
        // Muesca dicrótica / incisura en ~0.35 y pico diastólico secundario en ~0.42
        const p2 = Math.exp(-Math.pow((phase - 0.40) / 0.09, 2)) * 0.42;

        const val = p1 + p2;
        y[i] = val;
      }
    } else {
      // Fallback
      for (let i = 0; i < nSamples; i++) {
        y[i] = Math.sin(2.0 * Math.PI * 1.0 * t[i]);
      }
    }

    return { t, y, nSamples, fs, duration };
  }

  /**
   * 3. CONTAMINACIÓN DE SEÑALES (RUIDO CLÍNICO)
   */
  function contaminateSignal(
    signal,
    fs,
    {
      whiteNoiseAmp = 0.0,
      sineNoiseAmp = 0.0,
      sineNoiseFreq = 60.0,
      impulseProb = 0.0,
      impulseAmp = 0.0,
      seed = 42
    } = {}
  ) {
    const n = signal.length;
    const noisy = new Float64Array(n);
    const dt = 1.0 / fs;
    const rng = new SeededRandom(seed);

    for (let i = 0; i < n; i++) {
      let val = signal[i];
      const time = i * dt;

      // 1. Interferencia de red eléctrica (60 Hz o 50 Hz)
      if (sineNoiseAmp > 0) {
        val += sineNoiseAmp * Math.sin(2.0 * Math.PI * sineNoiseFreq * time);
      }

      // 2. Ruido blanco Gaussiano (térmico / amplificador)
      if (whiteNoiseAmp > 0) {
        val += rng.gaussian(0, whiteNoiseAmp);
      }

      // 3. Ruido impulsional (artefactos de movimiento / desconexión de electrodos)
      if (impulseProb > 0 && impulseAmp > 0) {
        if (rng.next() < impulseProb) {
          const sign = rng.next() > 0.5 ? 1.0 : -1.0;
          val += sign * impulseAmp;
        }
      }

      noisy[i] = val;
    }

    return noisy;
  }

  /**
   * 4. MAPEO A DAC 8-BIT (0 - 255) Y CÁLCULO DE TENSIÓN REAL (0.0 V - 3.3 V)
   */
  function mapToDac8Bit(
    signal,
    {
      autoScale = true,
      minVal = 0.0,
      maxVal = 3.3,
      marginPercent = 2.0
    } = {}
  ) {
    const n = signal.length;
    const dacValues = new Uint8Array(n);
    const voltages = new Float64Array(n);

    if (n === 0) return { dacValues, voltages };

    let sMin = Infinity;
    let sMax = -Infinity;

    for (let i = 0; i < n; i++) {
      const v = signal[i];
      if (v < sMin) sMin = v;
      if (v > sMax) sMax = v;
    }

    if (autoScale) {
      if (Math.abs(sMax - sMin) < 1e-9) {
        for (let i = 0; i < n; i++) {
          dacValues[i] = 128;
          voltages[i] = 1.65;
        }
        return { dacValues, voltages };
      }

      const span = sMax - sMin;
      const margin = span * (marginPercent / 100.0);
      const effMin = sMin - margin;
      const effMax = sMax + margin;
      const effSpan = effMax - effMin;

      for (let i = 0; i < n; i++) {
        const norm = (signal[i] - effMin) / effSpan;
        const dac = Math.min(255, Math.max(0, Math.round(norm * 255.0)));
        dacValues[i] = dac;
        voltages[i] = dac * (3.3 / 255.0);
      }
    } else {
      const span = maxVal - minVal;
      for (let i = 0; i < n; i++) {
        const norm = (signal[i] - minVal) / span;
        const dac = Math.min(255, Math.max(0, Math.round(norm * 255.0)));
        dacValues[i] = dac;
        voltages[i] = dac * (3.3 / 255.0);
      }
    }

    return { dacValues, voltages };
  }

  /**
   * 5. ANÁLISIS ESPECTRAL EN FRECUENCIA (FFT / DFT)
   * Devuelve las frecuencias (Hz) y magnitudes para graficar el espectro de potencia.
   */
  function computeFFT(signal, fs, maxFreq = 120) {
    const N = signal.length;
    if (N === 0) return { frequencies: [], magnitudes: [] };

    // Submuestreo o truncado si N es gigante para mantener la UI a 60 FPS
    const maxPoints = Math.min(N, 2048);
    const step = Math.max(1, Math.floor(N / maxPoints));
    const processedN = Math.floor(N / step);
    const effectiveFs = fs / step;

    // Calcular DFT optimizado para las frecuencias deseadas
    const numBins = Math.min(150, Math.floor((maxFreq / effectiveFs) * processedN));
    const frequencies = new Float64Array(numBins);
    const magnitudes = new Float64Array(numBins);

    // Remover componente DC para no eclipsar los armónicos de interés
    let mean = 0.0;
    for (let i = 0; i < processedN; i++) {
      mean += signal[i * step];
    }
    mean /= processedN;

    for (let k = 1; k < numBins; k++) {
      const freq = (k * effectiveFs) / processedN;
      frequencies[k] = Math.round(freq * 10) / 10;

      let real = 0.0;
      let imag = 0.0;
      const angleStep = (-2.0 * Math.PI * k) / processedN;

      for (let n = 0; n < processedN; n++) {
        const val = signal[n * step] - mean;
        const angle = angleStep * n;
        real += val * Math.cos(angle);
        imag += val * Math.sin(angle);
      }

      magnitudes[k] = (2.0 * Math.sqrt(real * real + imag * imag)) / processedN;
    }

    return {
      frequencies: Array.from(frequencies).slice(1),
      magnitudes: Array.from(magnitudes).slice(1)
    };
  }

  /**
   * 6. GENERADOR DE ARCHIVO PARA LITTLEFS (.CSV, .TXT, .DAT)
   */
  function formatFileContent(dacValues, fs, ext = 'csv') {
    const count = dacValues.length;
    const cleanExt = (ext || 'csv').toLowerCase().replace('.', '').trim();

    const lines = [
      '# CAYETINO SIGNAL FILE',
      `# FS:${fs}`,
      `# COUNT:${count}`,
      `# FORMAT:${cleanExt.toUpperCase()}`
    ];

    if (cleanExt === 'csv') {
      lines.push('index,dac_val,voltage_v');
      for (let i = 0; i < count; i++) {
        const v = (dacValues[i] * (3.3 / 255.0)).toFixed(3);
        lines.push(`${i},${dacValues[i]},${v}`);
      }
    } else {
      lines.push('# DATA');
      // 10 muestras por renglón para legibilidad
      const row = [];
      for (let i = 0; i < count; i++) {
        row.push(dacValues[i]);
        if (row.length === 10 || i === count - 1) {
          lines.push(row.join(','));
          row.length = 0;
        }
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * 7. PARSER INTELIGENTE DE ARCHIVOS EXTERNOS CARGADOS POR EL USUARIO
   * Lee archivos .csv, .txt o .dat y extrae metadatos (#FS:, #COUNT:) y muestras
   */
  function parseUploadedSignalFile(content, fallbackFs = 250) {
    if (!content || typeof content !== 'string') {
      throw new Error('El contenido del archivo está vacío o no es texto.');
    }

    const lines = content.split(/\r?\n/);
    let detectedFs = fallbackFs;
    let isCsvMultiCol = false;
    let targetColIdx = 1; // Por defecto columna 1 (segunda columna) en CSVs indexados
    const rawValues = [];
    const dataLines = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Metadatos en comentarios
      if (line.startsWith('#')) {
        const upper = line.toUpperCase();
        if (upper.includes('FS:') || upper.includes('FS =') || upper.includes('SAMPLING_RATE')) {
          const match = line.match(/(?:FS[:=]|\bFS\b\s*[:=]?)\s*(\d+)/i);
          if (match && match[1]) {
            detectedFs = parseInt(match[1], 10);
          }
        }
        continue;
      }

      // Detección de encabezado de columnas (ej. index,dac_val,voltage_v o time,signal)
      if (line.toLowerCase().includes('index') || line.toLowerCase().includes('dac_val') || line.toLowerCase().includes('voltage') || line.toLowerCase().includes('time')) {
        isCsvMultiCol = true;
        const headers = line.split(/[,;\t]/).map(h => h.trim().toLowerCase());
        const dacIdx = headers.findIndex(h => h.includes('dac') || h.includes('val') || h.includes('volt') || h.includes('amp') || h.includes('signal') || h.includes('ecg') || h.includes('ekg'));
        if (dacIdx !== -1) {
          targetColIdx = dacIdx;
        } else if (headers.length > 1) {
          targetColIdx = 1;
        }
        continue;
      }

      dataLines.push(line);
    }

    // Si no hubo encabezado explícito, analizar las primeras filas de datos para determinar estructura
    if (!isCsvMultiCol && dataLines.length > 0) {
      const sampleTokens = dataLines[0].split(/[,;\t]/);
      if (sampleTokens.length >= 2 && sampleTokens.length <= 4) {
        // Podría ser CSV multi-columna tipo "0, 128, 1.65"
        // Verificar si la primera columna es un índice entero creciente 0, 1, 2...
        if (dataLines.length >= 3) {
          const tok0 = parseFloat(dataLines[0].split(/[,;\t]/)[0]);
          const tok1 = parseFloat(dataLines[1].split(/[,;\t]/)[0]);
          const tok2 = parseFloat(dataLines[2].split(/[,;\t]/)[0]);
          if (!isNaN(tok0) && !isNaN(tok1) && !isNaN(tok2) && tok1 === tok0 + 1 && tok2 === tok1 + 1) {
            isCsvMultiCol = true;
            targetColIdx = 1;
          }
        }
      }
    }

    // Extraer datos según estructura
    if (isCsvMultiCol) {
      for (const line of dataLines) {
        const parts = line.split(/[,;\t]/);
        if (parts.length > targetColIdx) {
          const num = parseFloat(parts[targetColIdx].trim());
          if (!isNaN(num)) {
            rawValues.push(num);
          }
        }
      }
    } else {
      // Formato universal de muestras separadas por coma, tab o espacio (ej: "128,130,135,...")
      for (const line of dataLines) {
        const tokens = line.split(/[,;\t\s]+/);
        for (const token of tokens) {
          const trimmed = token.trim();
          if (trimmed === '') continue;
          const num = parseFloat(trimmed);
          if (!isNaN(num)) {
            rawValues.push(num);
          }
        }
      }
    }

    if (rawValues.length === 0) {
      throw new Error('No se encontraron valores numéricos válidos en el archivo.');
    }

    // Verificar si ya son valores DAC (0-255 enteros) o valores analógicos continuos
    let isAlreadyDac = true;
    for (let i = 0; i < Math.min(100, rawValues.length); i++) {
      const v = rawValues[i];
      if (v < 0 || v > 255 || !Number.isInteger(v)) {
        isAlreadyDac = false;
        break;
      }
    }

    let dacValues;
    let voltages;
    if (isAlreadyDac) {
      dacValues = new Uint8Array(rawValues.length);
      voltages = new Float64Array(rawValues.length);
      for (let i = 0; i < rawValues.length; i++) {
        const val = Math.min(255, Math.max(0, Math.round(rawValues[i])));
        dacValues[i] = val;
        voltages[i] = val * (3.3 / 255.0);
      }
    } else {
      const mapped = mapToDac8Bit(rawValues, { autoScale: true });
      dacValues = mapped.dacValues;
      voltages = mapped.voltages;
    }

    const duration = rawValues.length / detectedFs;
    const t = new Float64Array(rawValues.length);
    const dt = 1.0 / detectedFs;
    for (let i = 0; i < rawValues.length; i++) {
      t[i] = i * dt;
    }

    return {
      rawValues,
      dacValues,
      voltages,
      t,
      fs: detectedFs,
      samples: rawValues.length,
      duration: Math.round(duration * 100) / 100
    };
  }

  // Exportar API pública
  return {
    generateBasicSignal,
    generateBiomedicalSignal,
    contaminateSignal,
    mapToDac8Bit,
    computeFFT,
    formatFileContent,
    parseUploadedSignalFile
  };
});
