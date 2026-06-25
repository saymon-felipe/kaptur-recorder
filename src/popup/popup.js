/**
 * Popup Logic - Kaptur Recorder
 * Gerencia a interface de seleção de opções e inicia a solicitação de gravação.
 */

const ACTIONS = {
    REQUEST_RECORDING: "request_recording",
    REQUEST_DEVICES: "request_devices",
    GET_STATUS: "GET_RECORDING_STATUS"
};

const STORAGE_KEYS = {
    CAMERA: "cameraSelect",
    MIC: "microphoneSelect",
    SOURCE: "sourceSelect",
    TIMER: "waitSeconds",
    USE_TIMER: "timeoutCheckbox"s
};

const DEVICE_VALUES = {
    NONE: "none",
    DEFAULT: "default",
    SPECIFIC_PREFIX: "specific:"
};

const ui = {
    sources: document.querySelectorAll(".source-option"),
    sliderContainer: document.querySelector(".select-source-container"),
    cameraSelect: document.getElementById("camera-select"),
    micSelect: document.getElementById("mic-select"),
    timerSelect: document.getElementById("timer-select"),
    useTimerCheckbox: document.getElementById("use-timer"),
    startBtn: document.getElementById("start-btn"),
    errorMsg: document.getElementById("device-error-msg"),
    closeBtn: document.getElementById("close-btn"),
    shortcutsToggle: document.getElementById("shortcuts-toggle"),
    shortcutsContent: document.getElementById("shortcuts-content")
};

let activeTabId = null;

document.addEventListener("DOMContentLoaded", async () => {
    const activeTab = await getActiveTab();
    activeTabId = activeTab?.id || null;

    const status = await checkGlobalStatus();

    if (status.isBusy && status.reason === "recording") {
        showRecordingState(status.recordingTabId);
    } else if (status.isBusy && status.reason === "processing") {
        showProcessingState();
    } else {
        ui.startBtn.disabled = true;
        await loadPreferences();
        await refreshDevices();
        setupListeners();
    }
});

async function checkGlobalStatus() {
    const response = await sendRuntimeMessage({ action: ACTIONS.GET_STATUS });
    if (response && response.isBusy) {
        return {
            isBusy: true,
            reason: response.reason,
            recordingTabId: response.recordingTabId
        };
    }
    return { isBusy: false };
}

function showProcessingState() {
    ui.startBtn.disabled = true;
    ui.startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processando Vídeo...';
    if (ui.errorMsg) {
        ui.errorMsg.style.display = "block";
        ui.errorMsg.innerHTML = "Aguarde a finalização do vídeo anterior.";
    }
}

function showRecordingState(recordingTabId) {
    const configurations = document.querySelector(".configurations");
    if (configurations) configurations.style.display = "none";

    ui.startBtn.disabled = false;
    ui.startBtn.classList.add("stop-mode");
    ui.startBtn.innerHTML = '<i class="fa-solid fa-square"></i> PARAR GRAVAÇÃO';

    const newBtn = ui.startBtn.cloneNode(true);
    ui.startBtn.parentNode.replaceChild(newBtn, ui.startBtn);
    ui.startBtn = newBtn;

    ui.startBtn.addEventListener("click", () => {
        ui.startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Parando...';
        ui.startBtn.disabled = true;

        const stopPayload = {
            action: "keyboard_command",
            command: "stop"
        };

        if (recordingTabId) {
            chrome.tabs.sendMessage(recordingTabId, stopPayload, () => {
                setTimeout(() => window.close(), 500);
            });
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, stopPayload);
                window.close();
            });
        }
    });

    if (ui.errorMsg) {
        ui.errorMsg.style.display = "block";
        ui.errorMsg.style.color = "#e74c3c";
        ui.errorMsg.innerHTML = '<i class="fa-solid fa-circle fa-beat"></i> Gravando em andamento...';
    }
}

async function loadPreferences() {
    const data = await chrome.storage.local.get([
        STORAGE_KEYS.SOURCE,
        STORAGE_KEYS.TIMER,
        STORAGE_KEYS.USE_TIMER
    ]);

    if (data[STORAGE_KEYS.SOURCE]) {
        const sourcesArray = Array.from(ui.sources);
        const targetIndex = sourcesArray.findIndex((source) => source.dataset.source === data[STORAGE_KEYS.SOURCE]);
        if (targetIndex !== -1) {
            ui.sources.forEach((source) => source.classList.remove("selected"));
            ui.sources[targetIndex].classList.add("selected");
            ui.sliderContainer.setAttribute("data-selected-index", targetIndex);
        }
    }

    if (data[STORAGE_KEYS.TIMER]) {
        ui.timerSelect.value = data[STORAGE_KEYS.TIMER];
    }

    if (data[STORAGE_KEYS.USE_TIMER] !== undefined) {
        ui.useTimerCheckbox.checked = data[STORAGE_KEYS.USE_TIMER];
    }
}

function setupListeners() {
    ui.sources.forEach((source, index) => {
        source.addEventListener("click", () => {
            ui.sources.forEach((item) => item.classList.remove("selected"));
            source.classList.add("selected");
            ui.sliderContainer.setAttribute("data-selected-index", index);
            savePreference(STORAGE_KEYS.SOURCE, source.dataset.source);
            if (ui.errorMsg) ui.errorMsg.style.display = "none";
        });
    });

    ui.timerSelect.addEventListener("change", (event) => savePreference(STORAGE_KEYS.TIMER, event.target.value));
    ui.useTimerCheckbox.addEventListener("change", (event) => savePreference(STORAGE_KEYS.USE_TIMER, event.target.checked));
    ui.cameraSelect.addEventListener("change", (event) => savePreference(STORAGE_KEYS.CAMERA, event.target.value));
    ui.micSelect.addEventListener("change", (event) => savePreference(STORAGE_KEYS.MIC, event.target.value));

    ui.startBtn.addEventListener("click", handleStart);
    ui.closeBtn.addEventListener("click", closePopup);

    if (ui.shortcutsToggle) {
        ui.shortcutsToggle.addEventListener("click", () => {
            ui.shortcutsContent.classList.toggle("open");
            ui.shortcutsToggle.classList.toggle("active");
        });
    }

    const btnStudio = document.getElementById("btn-open-studio");
    if (btnStudio) {
        btnStudio.addEventListener("click", () => {
            chrome.tabs.create({ url: chrome.runtime.getURL("src/editor/editor.html?mode=studio") });
        });
    }
}

async function handleStart() {
    const tabId = activeTabId || (await getActiveTab())?.id;
    if (!tabId) return;

    if (ui.errorMsg) ui.errorMsg.style.display = "none";

    const selectedElement = document.querySelector(".source-option.selected");
    if (!selectedElement) return;

    const selectedSource = selectedElement.dataset.source;
    const useTimer = ui.useTimerCheckbox.checked;

    const payload = {
        action: ACTIONS.REQUEST_RECORDING,
        type: selectedSource,
        cameraSelection: getDeviceSelection(ui.cameraSelect),
        microphoneSelection: getDeviceSelection(ui.micSelect),
        timeout: useTimer ? parseInt(ui.timerSelect.value, 10) : 0,
        tabId
    };

    ui.startBtn.disabled = true;
    ui.startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Iniciando...';

    const response = await sendRuntimeMessage(payload);
    if (response?.error) {
        ui.startBtn.disabled = false;
        ui.startBtn.innerHTML = '<i class="fa-solid fa-circle-dot"></i> Iniciar gravacao';
        alert("Erro: " + response.error);
        return;
    }

    if (response?.allow) {
        closePopup();
    }
}

async function refreshDevices() {
    try {
        if (!activeTabId) throw new Error("Nenhuma aba ativa disponivel.");

        const response = await sendRuntimeMessage({
            action: ACTIONS.REQUEST_DEVICES,
            tabId: activeTabId
        });

        if (response?.error) throw new Error(response.error);

        populateDeviceSelect(ui.cameraSelect, response?.videoInputs || [], {
            noneLabel: "Não mostrar câmera",
            defaultLabel: "Câmera padrão",
            genericLabel: "Câmera"
        });

        populateDeviceSelect(ui.micSelect, response?.audioInputs || [], {
            noneLabel: "Sem microfone",
            defaultLabel: "Microfone padrão",
            genericLabel: "Microfone"
        });

        await restoreDeviceSelection();
        ui.startBtn.disabled = false;
    } catch (error) {
        console.warn("Falha ao listar dispositivos no popup:", error);
        populateDeviceSelect(ui.cameraSelect, [], {
            noneLabel: "Não mostrar câmera",
            defaultLabel: "Câmera padrão",
            genericLabel: "Câmera"
        });
        populateDeviceSelect(ui.micSelect, [], {
            noneLabel: "Sem microfone",
            defaultLabel: "Microfone padrão",
            genericLabel: "Microfone"
        });
        ui.startBtn.disabled = false;
    }
}

function populateDeviceSelect(select, devices, labels) {
    select.innerHTML = "";

    appendOption(select, DEVICE_VALUES.NONE, labels.noneLabel);
    appendOption(select, DEVICE_VALUES.DEFAULT, labels.defaultLabel);

    devices.forEach((device, index) => {
        const label = device.label || `${labels.genericLabel} ${index + 1}`;
        appendOption(select, `${DEVICE_VALUES.SPECIFIC_PREFIX}${device.deviceId}`, label);
    });
}

function appendOption(select, value, text) {
    const option = document.createElement("option");
    option.value = value;
    option.text = text;
    select.appendChild(option);
}

async function restoreDeviceSelection() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.CAMERA, STORAGE_KEYS.MIC]);
    setSelectByStoredValue(ui.cameraSelect, data[STORAGE_KEYS.CAMERA], "camera");
    setSelectByStoredValue(ui.micSelect, data[STORAGE_KEYS.MIC], "microphone");
}

function setSelectByStoredValue(select, storedValue, kind) {
    if (!storedValue) return;

    const preferredValue = normalizeLegacyStoredValue(storedValue, kind);
    const exactOption = Array.from(select.options).find((option) => option.value === preferredValue);
    if (exactOption) {
        select.value = exactOption.value;
        return;
    }

    const legacyLabelOption = Array.from(select.options).find((option) => option.text === storedValue);
    if (legacyLabelOption) {
        select.value = legacyLabelOption.value;
    }
}

function normalizeLegacyStoredValue(storedValue, kind) {
    if (typeof storedValue !== "string") return storedValue;
    if (storedValue === DEVICE_VALUES.NONE || storedValue === DEVICE_VALUES.DEFAULT || storedValue.startsWith(DEVICE_VALUES.SPECIFIC_PREFIX)) {
        return storedValue;
    }

    if (kind === "camera") {
        if (storedValue === "Câmera padrão") return DEVICE_VALUES.DEFAULT;
        if (storedValue === "Não mostrar câmera") return DEVICE_VALUES.NONE;
    } else {
        if (storedValue === "Sem microfone") return DEVICE_VALUES.NONE;
        if (storedValue === "Microfone padrão") return DEVICE_VALUES.DEFAULT;
    }

    return storedValue;
}

function getDeviceSelection(select) {
    const value = select.value;
    const option = select.options[select.selectedIndex];
    if (!value || value === DEVICE_VALUES.NONE) {
        return { mode: "none" };
    }

    if (value === DEVICE_VALUES.DEFAULT) {
        return { mode: "default" };
    }

    return {
        mode: "specific",
        deviceId: value.replace(DEVICE_VALUES.SPECIFIC_PREFIX, ""),
        label: option?.text || null
    };
}

function savePreference(key, value) {
    chrome.storage.local.set({ [key]: value });
}

async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

function closePopup() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                    const element = document.getElementById("kaptur-recorder-iframe");
                    if (element) {
                        element.style.opacity = "0";
                        setTimeout(() => element.remove(), 300);
                    }
                }
            });
        }
    });
}

function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {s
                resolve({ error: chrome.runtime.lastError.message });
                return;
            }
            resolve(response);
        });
    });
}
