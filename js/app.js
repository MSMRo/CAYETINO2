/**
 * ============================================================================
 * PROYECTO CAYETINO - APLICACIÓN PRINCIPAL (app.js)
 * Orquestación de interfaz, gráficos interactivos, Web Serial y reproducción DAC
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Instancias principales
  const client = new CayetinoSerialClient();
  let pollIntervalId = null;

  // Estado en memoria de señales calculadas
  let currentBasicData = null;
  let currentAdvData = null;
  let currentUploadData = null;
  let firmwareCode = '';

  // Instancias de Chart.js
  let chartBasicVolt = null;
  let chartBasicDac = null;
  let chartAdvComp = null;
  let chartAdvDac = null;
  let chartAdvFft = null;
  let chartUpload = null;

  // ==========================================================================
  // 1. INICIALIZACIÓN DE ELEMENTOS DEL DOM
  // ==========================================================================
  const chkSimulation = document.getElementById('chk-simulation');
  const btnConnect = document.getElementById('btn-connect');
  const btnDisconnect = document.getElementById('btn-disconnect');
  const selBaudrate = document.getElementById('sel-baudrate');
  const chkUsbOnly = document.getElementById('chk-usb-only');
  const statusBar = document.getElementById('status-bar');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  const tileDac25 = document.getElementById('tile-dac-25');
  const tileDac26 = document.getElementById('tile-dac-26');
  const btnFormatFs = document.getElementById('btn-format-fs');
  const btnToggleLog = document.getElementById('btn-toggle-log');
  const logDrawer = document.getElementById('log-drawer');
  const logContent = document.getElementById('log-content');

  const livePlaybackPill = document.getElementById('live-playback-pill');
  const liveDot = document.getElementById('live-dot');
  const livePlaybackText = document.getElementById('live-playback-text');

  // Pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Modo Básico
  const selBasicWave = document.getElementById('basic-wave-type');
  const sldBasicFreq = document.getElementById('basic-freq');
  const lblBasicFreq = document.getElementById('basic-freq-val');
  const sldBasicAmp = document.getElementById('basic-amp');
  const lblBasicAmp = document.getElementById('basic-amp-val');
  const sldBasicOffset = document.getElementById('basic-offset');
  const lblBasicOffset = document.getElementById('basic-offset-val');
  const sldBasicDuty = document.getElementById('basic-duty');
  const lblBasicDuty = document.getElementById('basic-duty-val');
  const rowBasicDuty = document.getElementById('basic-duty-row');
  const selBasicFs = document.getElementById('basic-fs');
  const sldBasicDuration = document.getElementById('basic-duration');
  const lblBasicDuration = document.getElementById('basic-duration-val');
  const metricBasicSamples = document.getElementById('basic-metric-samples');
  const metricBasicDt = document.getElementById('basic-metric-dt');
  const metricBasicCycles = document.getElementById('basic-metric-cycles');
  const txtBasicFilename = document.getElementById('basic-filename');
  const selBasicExt = document.getElementById('basic-ext');
  const btnSaveBasic = document.getElementById('btn-save-basic');
  const btnDownloadBasic = document.getElementById('btn-download-basic');

  // Modo Avanzado
  const selAdvBioType = document.getElementById('adv-bio-type');
  const sldAdvHr = document.getElementById('adv-hr');
  const lblAdvHr = document.getElementById('adv-hr-val');
  const grpAdvHr = document.getElementById('adv-hr-group');
  const sldAdvBursts = document.getElementById('adv-bursts');
  const lblAdvBursts = document.getElementById('adv-bursts-val');
  const sldAdvBurstDur = document.getElementById('adv-burst-dur');
  const lblAdvBurstDur = document.getElementById('adv-burst-dur-val');
  const grpAdvEmg = document.getElementById('adv-emg-group');
  const selAdvFs = document.getElementById('adv-fs');
  const sldAdvDuration = document.getElementById('adv-duration');
  const lblAdvDuration = document.getElementById('adv-duration-val');
  const metricAdvSamples = document.getElementById('adv-metric-samples');
  const metricAdvFlash = document.getElementById('adv-metric-flash');
  const metricAdvBeats = document.getElementById('adv-metric-beats');
  const chkNoiseSine = document.getElementById('chk-noise-sine');
  const ctrlNoiseSine = document.getElementById('noise-sine-controls');
  const sldNoiseSineAmp = document.getElementById('noise-sine-amp');
  const lblNoiseSineAmp = document.getElementById('noise-sine-amp-val');
  const btnFreq60 = document.getElementById('btn-freq-60');
  const btnFreq50 = document.getElementById('btn-freq-50');
  let selectedSineNoiseFreq = 60.0;
  const chkNoiseWhite = document.getElementById('chk-noise-white');
  const ctrlNoiseWhite = document.getElementById('noise-white-controls');
  const sldNoiseWhiteAmp = document.getElementById('noise-white-amp');
  const lblNoiseWhiteAmp = document.getElementById('noise-white-amp-val');
  const chkNoiseImpulse = document.getElementById('chk-noise-impulse');
  const ctrlNoiseImpulse = document.getElementById('noise-impulse-controls');
  const sldNoiseImpulseProb = document.getElementById('noise-impulse-prob');
  const lblNoiseImpulseProb = document.getElementById('noise-impulse-prob-val');
  const txtAdvFilename = document.getElementById('adv-filename');
  const selAdvExt = document.getElementById('adv-ext');
  const btnSaveAdv = document.getElementById('btn-save-adv');
  const btnDownloadAdv = document.getElementById('btn-download-adv');

  // Carga de Archivo
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');
  const uploadDetails = document.getElementById('upload-details');
  const upMetricName = document.getElementById('up-metric-name');
  const upMetricSize = document.getElementById('up-metric-size');
  const upMetricSamples = document.getElementById('up-metric-samples');
  const upMetricDuration = document.getElementById('up-metric-duration');
  const upCustomFs = document.getElementById('up-custom-fs');
  const upTargetFilename = document.getElementById('up-target-filename');
  const btnUploadSaveOnly = document.getElementById('btn-upload-save-only');
  const btnUploadAndPlay = document.getElementById('btn-upload-and-play');

  // Gestor LittleFS
  const tableFilesBody = document.getElementById('table-files-body');
  const btnRefreshFiles = document.getElementById('btn-refresh-files');
  const selActiveFile = document.getElementById('sel-active-file');
  const btnPlayFile = document.getElementById('btn-play-file');
  const btnStopFile = document.getElementById('btn-stop-file');
  const btnDeleteFile = document.getElementById('btn-delete-file');
  const btnTestSine = document.getElementById('btn-test-sine');

  // Guía y Firmware
  const btnCopyFirmware = document.getElementById('btn-copy-firmware');
  const firmwareCodeBox = document.getElementById('firmware-code-box');

  // Modal de Progreso
  const modalProgress = document.getElementById('modal-progress');
  const modalProgressTitle = document.getElementById('modal-progress-title');
  const modalProgressDesc = document.getElementById('modal-progress-desc');
  const modalProgressBar = document.getElementById('modal-progress-bar');
  const modalProgressText = document.getElementById('modal-progress-text');
  const modalProgressSamples = document.getElementById('modal-progress-samples');

  // ==========================================================================
  // 2. SISTEMA DE NOTIFICACIONES TOAST
  // ==========================================================================
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warn') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-size: 18px;">${icon}</span>
      <div style="flex:1; font-size: 0.85rem; font-weight: 500;">${message}</div>
      <button style="border:none; background:transparent; cursor:pointer; font-size:14px; color:#94A3B8;">✕</button>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => toast.remove());

    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, duration);
  }

  // ==========================================================================
  // 3. CONFIGURACIÓN DE GRÁFICOS (CHART.JS)
  // ==========================================================================
  function createChart(canvasId, label, color, yMin, yMax, yTitle) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: label,
          data: [],
          borderColor: color,
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.1,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            labels: { font: { size: 11, family: 'Inter' }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            titleFont: { size: 11 },
            bodyFont: { size: 11 }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 }, maxTicksLimit: 8 },
            title: { display: true, text: 'Tiempo (s)', font: { size: 11, weight: '600' } }
          },
          y: {
            min: yMin,
            max: yMax,
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 } },
            title: { display: !!yTitle, text: yTitle || '', font: { size: 11, weight: '600' } }
          }
        }
      }
    });
  }

  function initCharts() {
    chartBasicVolt = createChart('chart-basic-voltage', 'Tensión DAC (V)', '#2563EB', -0.1, 3.4, 'Voltios (V)');
    chartBasicDac = createChart('chart-basic-dac', 'Valor Cuantizado DAC (0-255)', '#10B981', -5, 260, 'Nivel 8-Bit');

    // Gráfico comparativo dual para Modo Avanzado
    const ctxAdvComp = document.getElementById('chart-adv-comparison').getContext('2d');
    chartAdvComp = new Chart(ctxAdvComp, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Señal Fisiológica Limpia',
            data: [],
            borderColor: '#059669',
            borderWidth: 1.8,
            pointRadius: 0,
            tension: 0.1,
            fill: false
          },
          {
            label: 'Señal Contaminada (Ruido)',
            data: [],
            borderColor: '#DC2626',
            borderWidth: 1.4,
            pointRadius: 0,
            tension: 0.1,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: true,
            labels: { font: { size: 11, family: 'Inter' }, boxWidth: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 }, maxTicksLimit: 8 },
            title: { display: true, text: 'Tiempo (s)', font: { size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 } },
            title: { display: true, text: 'Amplitud Relativa', font: { size: 11, weight: '600' } }
          }
        }
      }
    });

    chartAdvDac = createChart('chart-adv-dac', 'Tensión DAC Real (V)', '#3B82F6', -0.1, 3.4, 'Voltios (V)');

    // Gráfico FFT de Magnitud Espectral
    const ctxFft = document.getElementById('chart-adv-fft').getContext('2d');
    chartAdvFft = new Chart(ctxFft, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Densidad Espectral (FFT)',
          data: [],
          borderColor: '#8B5CF6',
          backgroundColor: 'rgba(139, 92, 246, 0.12)',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 }, maxTicksLimit: 12 },
            title: { display: true, text: 'Frecuencia (Hz)', font: { size: 11, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.7)' },
            ticks: { font: { size: 10 } },
            title: { display: true, text: 'Magnitud', font: { size: 11, weight: '600' } }
          }
        }
      }
    });

    chartUpload = createChart('chart-upload-preview', 'Tensión Analógica Estimada DAC (V)', '#059669', -0.1, 3.4, 'Voltios (V)');
  }

  // ==========================================================================
  // 4. ACTUALIZACIÓN Y SÍNTESIS DE SEÑALES
  // ==========================================================================

  // MODO BÁSICO
  function updateBasicSignal() {
    const waveType = selBasicWave.value;
    const freq = parseFloat(sldBasicFreq.value);
    const amp = parseFloat(sldBasicAmp.value);
    const offset = parseFloat(sldBasicOffset.value);
    const duty = parseFloat(sldBasicDuty.value);
    const fs = parseInt(selBasicFs.value, 10);
    const duration = parseFloat(sldBasicDuration.value);

    // Ajustar visibilidad de Duty Cycle
    rowBasicDuty.style.display = (waveType === 'cuadrada') ? 'flex' : 'none';

    // Generar señal
    const basicRes = CayetinoSignal.generateBasicSignal({
      type: waveType,
      freq,
      fs,
      duration,
      amplitude: amp,
      offset,
      dutyCycle: duty
    });

    // Mapear a DAC 8-bit
    const mapped = CayetinoSignal.mapToDac8Bit(basicRes.y, { autoScale: true });
    currentBasicData = {
      ...basicRes,
      dacValues: mapped.dacValues,
      voltages: mapped.voltages
    };

    // Actualizar métricas visuales
    metricBasicSamples.textContent = basicRes.nSamples.toLocaleString();
    metricBasicDt.textContent = `${(1000.0 / fs).toFixed(2)} ms`;
    metricBasicCycles.textContent = (freq * duration).toFixed(1);

    // Actualizar nombre sugerido de archivo
    txtBasicFilename.value = `${waveType}_${Math.round(freq)}hz`;

    // Actualizar gráficos (submuestreo si hay más de 1500 puntos para rendimiento óptimo)
    updateChartDisplay(chartBasicVolt, basicRes.t, mapped.voltages, 1200);
    updateChartDisplay(chartBasicDac, basicRes.t, mapped.dacValues, 1200);
  }

  // MODO AVANZADO (BIOMÉDICO & RUIDO)
  function updateAdvSignal() {
    const bioType = selAdvBioType.value;
    const hr = parseInt(sldAdvHr.value, 10);
    const bursts = parseInt(sldAdvBursts.value, 10);
    const burstDur = parseFloat(sldAdvBurstDur.value);
    const fs = parseInt(selAdvFs.value, 10);
    const duration = parseFloat(sldAdvDuration.value);

    // Ajustar controles contextuales según tipo fisiológico
    if (bioType === 'ekg' || bioType === 'ppg') {
      grpAdvHr.style.display = 'flex';
      grpAdvEmg.style.display = 'none';
    } else if (bioType === 'emg') {
      grpAdvHr.style.display = 'none';
      grpAdvEmg.style.display = 'grid';
    } else {
      grpAdvHr.style.display = 'none';
      grpAdvEmg.style.display = 'none';
    }

    // 1. Generar señal limpia
    const bioRes = CayetinoSignal.generateBiomedicalSignal({
      type: bioType,
      fs,
      duration,
      heartRate: hr,
      burstNumber: bursts,
      burstDuration: burstDur
    });

    // 2. Parámetros de ruido
    const useSine = chkNoiseSine.checked;
    const sineAmp = useSine ? parseFloat(sldNoiseSineAmp.value) : 0.0;
    const sineFreq = selectedSineNoiseFreq;

    const useWhite = chkNoiseWhite.checked;
    const whiteAmp = useWhite ? parseFloat(sldNoiseWhiteAmp.value) : 0.0;

    const useImpulse = chkNoiseImpulse.checked;
    const impulseProb = useImpulse ? (parseFloat(sldNoiseImpulseProb.value) / 100.0) : 0.0;
    const impulseAmp = useImpulse ? 0.8 : 0.0;

    // 3. Contaminar señal
    const yContaminated = CayetinoSignal.contaminateSignal(bioRes.y, fs, {
      whiteNoiseAmp: whiteAmp,
      sineNoiseAmp: sineAmp,
      sineNoiseFreq: sineFreq,
      impulseProb,
      impulseAmp
    });

    // 4. Mapear a DAC
    const mapped = CayetinoSignal.mapToDac8Bit(yContaminated, { autoScale: true });

    currentAdvData = {
      ...bioRes,
      yClean: bioRes.y,
      yContaminated,
      dacValues: mapped.dacValues,
      voltages: mapped.voltages
    };

    // Actualizar métricas
    metricAdvSamples.textContent = bioRes.nSamples.toLocaleString();
    metricAdvFlash.textContent = `~${((bioRes.nSamples * 5.8) / 1024).toFixed(1)} KB`;
    if (bioType === 'ekg' || bioType === 'ppg') {
      metricAdvBeats.textContent = Math.round((hr / 60.0) * duration);
    } else {
      metricAdvBeats.textContent = bursts;
    }

    // Nombre de archivo sugerido
    let noiseSuffix = '';
    if (useSine) noiseSuffix += `_ruido${Math.round(sineFreq)}hz`;
    if (useWhite) noiseSuffix += '_blanco';
    if (useImpulse) noiseSuffix += '_spikes';
    txtAdvFilename.value = `${bioType}_${Math.round(duration)}s${noiseSuffix}`;

    // Actualizar gráficos
    updateAdvCharts(bioRes.t, bioRes.y, yContaminated, mapped.voltages, fs);
  }

  function updateAdvCharts(t, yClean, yNoisy, voltages, fs) {
    const maxPoints = 1200;
    const step = Math.max(1, Math.floor(t.length / maxPoints));

    const labels = [];
    const cleanSub = [];
    const noisySub = [];
    const voltSub = [];

    for (let i = 0; i < t.length; i += step) {
      labels.push(t[i].toFixed(2));
      cleanSub.push(yClean[i]);
      noisySub.push(yNoisy[i]);
      voltSub.push(voltages[i]);
    }

    // Gráfico comparativo
    chartAdvComp.data.labels = labels;
    chartAdvComp.data.datasets[0].data = cleanSub;
    chartAdvComp.data.datasets[1].data = (chkNoiseSine.checked || chkNoiseWhite.checked || chkNoiseImpulse.checked) ? noisySub : [];
    chartAdvComp.update();

    // Gráfico de salida DAC
    chartAdvDac.data.labels = labels;
    chartAdvDac.data.datasets[0].data = voltSub;
    chartAdvDac.update();

    // Gráfico FFT
    const fftRes = CayetinoSignal.computeFFT(yNoisy, fs, 120);
    chartAdvFft.data.labels = fftRes.frequencies.map((f) => f.toFixed(1));
    chartAdvFft.data.datasets[0].data = fftRes.magnitudes;
    chartAdvFft.update();
  }

  function updateChartDisplay(chart, t, data, maxPoints = 1200) {
    const step = Math.max(1, Math.floor(t.length / maxPoints));
    const labels = [];
    const subset = [];

    for (let i = 0; i < t.length; i += step) {
      labels.push(t[i].toFixed(2));
      subset.push(data[i]);
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = subset;
    chart.update();
  }

  // ==========================================================================
  // 5. MANEJO DE TRANSMISIÓN A LITTLEFS (MODAL & PROGRESS)
  // ==========================================================================
  async function transmitFileToEsp32(filename, fs, dacValues, autoPlay = false) {
    if (!client.isConnected) {
      showToast('Por favor conecta el ESP32 o activa el Modo Simulación primero.', 'error');
      return;
    }

    modalProgressTitle.textContent = `Transmitiendo '${filename}' a LittleFS...`;
    modalProgressDesc.textContent = `Enviando ${dacValues.length.toLocaleString()} muestras cuantizadas en bloques con verificación de flujo (ACK)...`;
    modalProgressBar.style.width = '0%';
    modalProgressText.textContent = '0%';
    modalProgressSamples.textContent = `0 / ${dacValues.length} muestras`;
    modalProgress.classList.add('open');

    try {
      const success = await client.saveFile(
        filename,
        fs,
        dacValues,
        64,
        (ratio) => {
          const pct = Math.round(ratio * 100);
          modalProgressBar.style.width = `${pct}%`;
          modalProgressText.textContent = `${pct}%`;
          const currentCount = Math.min(dacValues.length, Math.round(ratio * dacValues.length));
          modalProgressSamples.textContent = `${currentCount.toLocaleString()} / ${dacValues.length.toLocaleString()} muestras`;
        }
      );

      modalProgress.classList.remove('open');

      if (success) {
        showToast(`¡Archivo '${filename}' grabado con éxito en LittleFS!`, 'success');
        await refreshFilesList();

        if (autoPlay) {
          showToast(`Iniciando reproducción continua de '${filename}' por DAC...`, 'info');
          await handlePlayFile(filename);
        }
      } else {
        showToast('Falló la confirmación de guardado en el ESP32.', 'error');
      }
    } catch (err) {
      modalProgress.classList.remove('open');
      showToast(`Error al transferir archivo: ${err.message}`, 'error', 5000);
    }
  }

  function downloadLocalFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Archivo '${filename}' descargado en tu equipo.`, 'success');
  }

  // ==========================================================================
  // 6. GESTIÓN DE ARCHIVOS Y REPRODUCCIÓN DAC
  // ==========================================================================
  async function refreshFilesList() {
    if (!client.isConnected) {
      tableFilesBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">
            ESP32 desconectado. Conéctalo desde la barra lateral o activa el Modo Simulación para listar los archivos.
          </td>
        </tr>`;
      selActiveFile.innerHTML = '<option value="">(Ningún archivo disponible)</option>';
      return;
    }

    try {
      const files = await client.listFiles();
      selActiveFile.innerHTML = '';

      if (files.length === 0) {
        tableFilesBody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">
              ℹ️ No hay archivos en LittleFS todavía. Genera una señal o carga un archivo para empezar.
            </td>
          </tr>`;
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(Sin archivos en Flash)';
        selActiveFile.appendChild(opt);
        return;
      }

      tableFilesBody.innerHTML = '';
      files.forEach((f) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${f.name}</b></td>
          <td><span class="badge" style="background:#EFF6FF; color:#1E40AF; padding:2px 8px; border-radius:4px; font-weight:700;">${f.fs} Hz</span></td>
          <td>${f.samples.toLocaleString()}</td>
          <td>${f.duration} s</td>
          <td>${(f.sizeBytes / 1024).toFixed(1)} KB</td>
          <td style="text-align: right;">
            <button class="btn btn-primary btn-sm btn-table-play" data-file="${f.name}" style="padding:4px 8px; margin-right:4px;">▶️ Play</button>
            <button class="btn btn-outline btn-sm btn-table-del" data-file="${f.name}" style="padding:4px 8px; color:var(--danger);">🗑️</button>
          </td>
        `;

        tr.querySelector('.btn-table-play').addEventListener('click', () => {
          selActiveFile.value = f.name;
          handlePlayFile(f.name);
        });

        tr.querySelector('.btn-table-del').addEventListener('click', () => {
          handleDeleteFile(f.name);
        });

        tableFilesBody.appendChild(tr);

        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = `${f.name} (${f.fs} Hz, ${f.samples} pts)`;
        selActiveFile.appendChild(opt);
      });
    } catch (err) {
      showToast(`Error al listar archivos: ${err.message}`, 'error');
    }
  }

  async function handlePlayFile(filename) {
    if (!filename) {
      showToast('Por favor selecciona un archivo para reproducir.', 'warn');
      return;
    }

    try {
      const res = await client.playFile(filename);
      if (res.success) {
        showToast(`¡Reproduciendo '${filename}' por el DAC del ESP32!`, 'success');
        updateLiveStatus(true, filename, res.fs);
      } else {
        showToast(`No se pudo iniciar reproducción: ${res.error || 'Error desconocido'}`, 'error');
      }
    } catch (err) {
      showToast(`Error al reproducir: ${err.message}`, 'error');
    }
  }

  async function handleStopPlayback() {
    try {
      const ok = await client.stopPlayback();
      if (ok) {
        showToast('Reproducción detenida. Salida DAC en reposo (~1.65 V).', 'info');
        updateLiveStatus(false);
      }
    } catch (err) {
      showToast(`Error al detener: ${err.message}`, 'error');
    }
  }

  async function handleDeleteFile(filename) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente '${filename}' de la memoria Flash del ESP32?`)) {
      return;
    }

    try {
      const ok = await client.deleteFile(filename);
      if (ok) {
        showToast(`Archivo '${filename}' eliminado.`, 'info');
        await refreshFilesList();
        const stat = await client.getStatus();
        updateLiveStatus(stat.playing, stat.filename, stat.fs);
      } else {
        showToast(`No se pudo eliminar el archivo.`, 'error');
      }
    } catch (err) {
      showToast(`Error al eliminar: ${err.message}`, 'error');
    }
  }

  function updateLiveStatus(isPlaying, filename = '', fs = 0) {
    if (isPlaying) {
      livePlaybackPill.className = 'live-status-pill playing';
      liveDot.className = 'status-dot playing';
      livePlaybackText.innerHTML = `▶️ REPRODUCIENDO: <b>${filename}</b> (${fs} Hz) | GPIO ${client.activeDacPin}`;
    } else {
      livePlaybackPill.className = 'live-status-pill idle';
      liveDot.className = 'status-dot';
      livePlaybackText.textContent = `DAC en Nivel Neutro (~1.65 V) | GPIO ${client.activeDacPin}`;
    }
  }

  // ==========================================================================
  // 7. CARGA DE ARCHIVO EXTERNO
  // ==========================================================================
  function handleUploadedFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = CayetinoSignal.parseUploadedSignalFile(text, parseInt(upCustomFs.value, 10) || 250);

        currentUploadData = {
          file,
          ...parsed
        };

        // Mostrar detalles
        upMetricName.textContent = file.name;
        upMetricSize.textContent = `${(file.size / 1024).toFixed(1)} KB`;
        upMetricSamples.textContent = parsed.samples.toLocaleString();
        upCustomFs.value = parsed.fs;
        upMetricDuration.textContent = `${parsed.duration} s`;
        upTargetFilename.value = file.name.replace(/\s+/g, '_');

        uploadDetails.style.display = 'block';

        // Actualizar previsualización
        updateChartDisplay(chartUpload, parsed.t, parsed.voltages, 1200);

        showToast(`Archivo '${file.name}' analizado con éxito (${parsed.samples} muestras).`, 'success');
      } catch (err) {
        showToast(`Error al procesar archivo: ${err.message}`, 'error', 5000);
      }
    };
    reader.readAsText(file);
  }

  // ==========================================================================
  // 8. CONEXIÓN SERIAL Y SIMULACIÓN
  // ==========================================================================
  async function connectSerial() {
    const baudRate = parseInt(selBaudrate.value, 10);
    const filterUsbOnly = chkUsbOnly ? chkUsbOnly.checked : true;
    try {
      btnConnect.disabled = true;
      btnConnect.innerHTML = '<span>⏳ Conectando...</span>';

      const ok = await client.requestAndConnect(baudRate, filterUsbOnly);
      if (ok) {
        updateConnectionUI(true);
        showToast('¡ESP32 conectado con éxito!', 'success');
        await refreshFilesList();
        startStatusPolling();
      } else {
        updateConnectionUI(false);
      }
    } catch (err) {
      updateConnectionUI(false);
      showToast(`Error al conectar: ${err.message}`, 'error', 5000);
    } finally {
      btnConnect.disabled = false;
      btnConnect.innerHTML = '<span>🔗 Conectar ESP32</span>';
    }
  }

  async function disconnectSerial() {
    stopStatusPolling();
    await client.disconnect();
    updateConnectionUI(false);
    updateLiveStatus(false);
    await refreshFilesList();
    showToast('Desconectado del ESP32.', 'info');
  }

  function updateConnectionUI(connected) {
    if (connected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = client.simulationMode ? 'Modo Simulación Activo' : 'ESP32 Conectado';
      statusBar.style.borderColor = 'var(--success-border)';
      btnConnect.style.display = 'none';
      btnDisconnect.style.display = 'inline-flex';
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Desconectado';
      statusBar.style.borderColor = 'var(--border-light)';
      btnConnect.style.display = 'inline-flex';
      btnDisconnect.style.display = 'none';
    }
  }

  function startStatusPolling() {
    stopStatusPolling();
    pollIntervalId = setInterval(async () => {
      if (client.isConnected) {
        const stat = await client.getStatus();
        updateLiveStatus(stat.playing, stat.filename, stat.fs);
      }
    }, 2500);
  }

  function stopStatusPolling() {
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
  }

  // ==========================================================================
  // 9. EVENT LISTENERS
  // ==========================================================================

  // Pestañas
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      // Reiniciar scroll superior para asegurar que la vista siempre empiece arriba
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTop = 0;
      }

      // Reajustar dimensiones de los gráficos para la pestaña activa
      setTimeout(() => {
        if (targetId === 'tab-basic') {
          if (chartBasicVolt) chartBasicVolt.resize();
          if (chartBasicDac) chartBasicDac.resize();
        } else if (targetId === 'tab-advanced') {
          if (chartAdvComp) chartAdvComp.resize();
          if (chartAdvDac) chartAdvDac.resize();
          if (chartAdvFft) chartAdvFft.resize();
        } else if (targetId === 'tab-upload') {
          if (chartUpload) chartUpload.resize();
        } else if (targetId === 'tab-manager') {
          refreshFilesList();
        }
      }, 50);
    });
  });

  // Conexión
  btnConnect.addEventListener('click', connectSerial);
  btnDisconnect.addEventListener('click', disconnectSerial);

  chkSimulation.addEventListener('change', async (e) => {
    client.simulationMode = e.target.checked;
    if (client.simulationMode) {
      await connectSerial();
    } else {
      await disconnectSerial();
    }
  });

  // Pin DAC
  tileDac25.addEventListener('click', async () => {
    tileDac25.classList.add('active');
    tileDac26.classList.remove('active');
    await client.setDacPin(25);
    updateLiveStatus(client.simStatus.playing, client.simStatus.filename, client.simStatus.fs);
  });

  tileDac26.addEventListener('click', async () => {
    tileDac26.classList.add('active');
    tileDac25.classList.remove('active');
    await client.setDacPin(26);
    updateLiveStatus(client.simStatus.playing, client.simStatus.filename, client.simStatus.fs);
  });

  // Formatear LittleFS
  btnFormatFs.addEventListener('click', async () => {
    if (!client.isConnected) {
      showToast('Conecta el ESP32 primero.', 'warn');
      return;
    }
    if (confirm('⚠️ ¿Estás COMPLETAMENTE seguro de formatear LittleFS? Se borrarán todos los archivos de señal guardados en el ESP32.')) {
      const ok = await client.formatFS();
      if (ok) {
        showToast('Memoria Flash LittleFS formateada correctamente.', 'success');
        await refreshFilesList();
      } else {
        showToast('Fallo al formatear memoria.', 'error');
      }
    }
  });

  // Drawer de logs
  btnToggleLog.addEventListener('click', () => {
    const isHidden = logDrawer.style.display === 'none';
    logDrawer.style.display = isHidden ? 'block' : 'none';
    btnToggleLog.textContent = isHidden ? 'Ocultar' : 'Ver';
  });

  client.onLogCallback = (entry) => {
    const p = document.createElement('div');
    p.className = `log-entry ${entry.type}`;
    p.textContent = `[${entry.time}] ${entry.msg}`;
    logContent.appendChild(p);
    logDrawer.scrollTop = logDrawer.scrollHeight;
  };

  // Controles Modo Básico
  selBasicWave.addEventListener('change', updateBasicSignal);
  sldBasicFreq.addEventListener('input', (e) => {
    lblBasicFreq.textContent = `${parseFloat(e.target.value).toFixed(1)} Hz`;
    updateBasicSignal();
  });
  sldBasicAmp.addEventListener('input', (e) => {
    lblBasicAmp.textContent = parseFloat(e.target.value).toFixed(2);
    updateBasicSignal();
  });
  sldBasicOffset.addEventListener('input', (e) => {
    lblBasicOffset.textContent = parseFloat(e.target.value).toFixed(2);
    updateBasicSignal();
  });
  sldBasicDuty.addEventListener('input', (e) => {
    lblBasicDuty.textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`;
    updateBasicSignal();
  });
  selBasicFs.addEventListener('change', updateBasicSignal);
  sldBasicDuration.addEventListener('input', (e) => {
    lblBasicDuration.textContent = `${parseFloat(e.target.value).toFixed(1)} s`;
    updateBasicSignal();
  });

  btnSaveBasic.addEventListener('click', async () => {
    if (!currentBasicData) return;
    const fname = txtBasicFilename.value.trim() + selBasicExt.value;
    const fs = parseInt(selBasicFs.value, 10);
    await transmitFileToEsp32(fname, fs, currentBasicData.dacValues, false);
  });

  btnDownloadBasic.addEventListener('click', () => {
    if (!currentBasicData) return;
    const fname = txtBasicFilename.value.trim() + selBasicExt.value;
    const fs = parseInt(selBasicFs.value, 10);
    const content = CayetinoSignal.formatFileContent(currentBasicData.dacValues, fs, selBasicExt.value);
    downloadLocalFile(fname, content);
  });

  // Controles Modo Avanzado
  selAdvBioType.addEventListener('change', updateAdvSignal);
  sldAdvHr.addEventListener('input', (e) => {
    lblAdvHr.textContent = `${e.target.value} BPM`;
    updateAdvSignal();
  });
  sldAdvBursts.addEventListener('input', (e) => {
    lblAdvBursts.textContent = e.target.value;
    updateAdvSignal();
  });
  sldAdvBurstDur.addEventListener('input', (e) => {
    lblAdvBurstDur.textContent = `${parseFloat(e.target.value).toFixed(1)} s`;
    updateAdvSignal();
  });
  selAdvFs.addEventListener('change', updateAdvSignal);
  sldAdvDuration.addEventListener('input', (e) => {
    lblAdvDuration.textContent = `${parseFloat(e.target.value).toFixed(1)} s`;
    updateAdvSignal();
  });

  // Ruido
  chkNoiseSine.addEventListener('change', (e) => {
    ctrlNoiseSine.style.display = e.target.checked ? 'flex' : 'none';
    updateAdvSignal();
  });
  sldNoiseSineAmp.addEventListener('input', (e) => {
    lblNoiseSineAmp.textContent = parseFloat(e.target.value).toFixed(2);
    updateAdvSignal();
  });
  btnFreq60.addEventListener('click', () => {
    selectedSineNoiseFreq = 60.0;
    btnFreq60.classList.add('active');
    btnFreq50.classList.remove('active');
    updateAdvSignal();
  });
  btnFreq50.addEventListener('click', () => {
    selectedSineNoiseFreq = 50.0;
    btnFreq50.classList.add('active');
    btnFreq60.classList.remove('active');
    updateAdvSignal();
  });

  chkNoiseWhite.addEventListener('change', (e) => {
    ctrlNoiseWhite.style.display = e.target.checked ? 'flex' : 'none';
    updateAdvSignal();
  });
  sldNoiseWhiteAmp.addEventListener('input', (e) => {
    lblNoiseWhiteAmp.textContent = parseFloat(e.target.value).toFixed(2);
    updateAdvSignal();
  });

  chkNoiseImpulse.addEventListener('change', (e) => {
    ctrlNoiseImpulse.style.display = e.target.checked ? 'flex' : 'none';
    updateAdvSignal();
  });
  sldNoiseImpulseProb.addEventListener('input', (e) => {
    lblNoiseImpulseProb.textContent = `${parseFloat(e.target.value).toFixed(1)}%`;
    updateAdvSignal();
  });

  btnSaveAdv.addEventListener('click', async () => {
    if (!currentAdvData) return;
    const fname = txtAdvFilename.value.trim() + selAdvExt.value;
    const fs = parseInt(selAdvFs.value, 10);
    await transmitFileToEsp32(fname, fs, currentAdvData.dacValues, false);
  });

  btnDownloadAdv.addEventListener('click', () => {
    if (!currentAdvData) return;
    const fname = txtAdvFilename.value.trim() + selAdvExt.value;
    const fs = parseInt(selAdvFs.value, 10);
    const content = CayetinoSignal.formatFileContent(currentAdvData.dacValues, fs, selAdvExt.value);
    downloadLocalFile(fname, content);
  });

  // Carga de archivo Drag and drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleUploadedFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUploadedFile(e.target.files[0]);
    }
  });

  upCustomFs.addEventListener('change', () => {
    if (currentUploadData && currentUploadData.rawValues) {
      const newFs = parseInt(upCustomFs.value, 10) || 250;
      currentUploadData.fs = newFs;
      currentUploadData.duration = Math.round((currentUploadData.samples / newFs) * 100) / 100;
      upMetricDuration.textContent = `${currentUploadData.duration} s`;
      for (let i = 0; i < currentUploadData.samples; i++) {
        currentUploadData.t[i] = i / newFs;
      }
      updateChartDisplay(chartUpload, currentUploadData.t, currentUploadData.voltages, 1200);
    }
  });

  btnUploadSaveOnly.addEventListener('click', async () => {
    if (!currentUploadData) return;
    const fname = upTargetFilename.value.trim() || 'mi_senal.csv';
    await transmitFileToEsp32(fname, currentUploadData.fs, currentUploadData.dacValues, false);
  });

  btnUploadAndPlay.addEventListener('click', async () => {
    if (!currentUploadData) return;
    const fname = upTargetFilename.value.trim() || 'mi_senal.csv';
    await transmitFileToEsp32(fname, currentUploadData.fs, currentUploadData.dacValues, true);
  });

  // Gestor LittleFS
  btnRefreshFiles.addEventListener('click', refreshFilesList);
  btnPlayFile.addEventListener('click', () => {
    const fname = selActiveFile.value;
    handlePlayFile(fname);
  });
  btnStopFile.addEventListener('click', handleStopPlayback);
  btnDeleteFile.addEventListener('click', () => {
    const fname = selActiveFile.value;
    if (fname) handleDeleteFile(fname);
  });

  btnTestSine.addEventListener('click', async () => {
    if (!client.isConnected) {
      showToast('Conecta el ESP32 primero.', 'warn');
      return;
    }
    try {
      const res = await client.playTestSine();
      if (res.success) {
        showToast('¡Señal de prueba de 5 Hz activada por el DAC!', 'success');
        updateLiveStatus(true, 'TEST_SENO_5HZ', 500);
      }
    } catch (err) {
      showToast(`Error al iniciar prueba: ${err.message}`, 'error');
    }
  });

  // Guía y Firmware
  btnCopyFirmware.addEventListener('click', () => {
    if (firmwareCodeBox.value) {
      navigator.clipboard.writeText(firmwareCodeBox.value);
      showToast('¡Código de firmware copiado al portapapeles!', 'success');
    }
  });

  // Cargar texto de cayetino_esp32.ino
  async function loadFirmwareCode() {
    try {
      const resp = await fetch('firmware/cayetino_esp32.ino');
      if (resp.ok) {
        firmwareCode = await resp.text();
        firmwareCodeBox.value = firmwareCode;
      }
    } catch (e) {
      // Fallback si corre en file://
      firmwareCodeBox.value = '// Firmware disponible en la carpeta firmware/cayetino_esp32.ino\n// Sube el proyecto a GitHub Pages o ejecútalo con un servidor local para previsualizar aquí.';
    }
  }

  // ==========================================================================
  // 10. ARRANQUE INICIAL
  // ==========================================================================
  initCharts();
  updateBasicSignal();
  updateAdvSignal();
  loadFirmwareCode();

  // Comprobar soporte Web Serial
  if (!CayetinoSerialClient.isWebSerialSupported()) {
    showToast(
      'Aviso: Tu navegador actual no tiene activada la Web Serial API. Para conectar el ESP32 usa Google Chrome o Microsoft Edge. Puedes usar el Modo Simulación libremente.',
      'warn',
      7000
    );
  }
});
