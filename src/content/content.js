/**
 * Content Script - Kaptur Recorder
 */
(function () {
    if (window.KapturContentInitialized) return;
    window.KapturContentInitialized = true;

    const C = window.KapturConstants;
    const recorderManager = new window.KapturRecorderManager();
    const uiManager = window.KapturUIManager.getInstance();

    const DEVICE_MODE = {
        NONE: "none",
        DEFAULT: "default",
        SPECIFIC: "specific"
    };

    let audioMixer = null;
    let signalingService = null;
    let activeMainStream = null;
    let activeSecondaryStream = null;
    let activePreviewStream = null;

    checkRecoverySession();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        handleMessage(message).then(sendResponse).catch((err) => {
            console.error("[Kaptur Content] Erro handler:", err);
            sendResponse({ allow: false, error: err.message });
        });
        return true;
    });

    async function handleMessage(msg) {
        switch (msg.action) {
            case C.ACTIONS.REQUEST_RECORDING:
                return await startRecordingSession(msg);
            case C.ACTIONS.REQUEST_DEVICES:
                return await getAvailableDevices();
            case C.ACTIONS.WEBRTC_ANSWER:
                if (signalingService) await signalingService.handleAnswer(msg.answer);
                return { success: true };
            case C.ACTIONS.WEBRTC_CANDIDATE:
                if (signalingService) await signalingService.handleCandidate(msg.candidate);
                return { success: true };
            case C.ACTIONS.KILL_UI:
                await cleanupSession();
                return { success: true };
            case C.ACTIONS.KEYBOARD_COMMAND:
                handleKeyboardCommand(msg.command);
                return { success: true };
            default:
                return { result: "ignored" };
        }
    }

    function handleKeyboardCommand(command) {
        if (recorderManager.status === "idle" && recorderManager.status !== "paused") return;
        switch (command) {
            case C.COMMANDS.STOP:
            case "stop_recording_command":
                recorderManager.stop();
                break;
            case C.COMMANDS.CANCEL:
                if (confirm("Deseja cancelar a gravacao atual?")) recorderManager.cancel();
                break;
            case C.COMMANDS.TOGGLE_PAUSE:
                if (recorderManager.status === "recording") recorderManager.pause();
                else if (recorderManager.status === "paused") handleRecoveredUserAction("resume", null);
                break;
        }
    }

    function closePopup() {
        const iframe = document.getElementById("kaptur-recorder-iframe");
        if (iframe) {
            iframe.style.transition = "opacity 0.3s ease";
            iframe.style.opacity = "0";
            setTimeout(() => iframe.remove(), 300);
        }
    }

    async function startRecordingSession(options) {
        try {
            closePopup();
            await cleanupSession();

            const { mainStream, secondaryStream } = await acquireMediaStreams(options);
            activeMainStream = mainStream;
            activeSecondaryStream = secondaryStream;

            audioMixer = new window.KapturAudioMixer();
            const streamForRecording = await audioMixer.mix(mainStream, secondaryStream);

            if (options.type === C.SOURCE_TYPE.TAB) {
                await setupTabMirroring(mainStream, options.tabId);
            }

            const onUIReady = async () => {
                await injectWebcam(options, options.type);
            };

            await recorderManager.start(
                streamForRecording,
                options,
                () => cleanupSession(),
                onUIReady
            );

            return { allow: true };
        } catch (error) {
            console.error("[Kaptur Content] Falha ao iniciar:", error);
            await cleanupSession();
            throw error;
        }
    }

    async function cleanupSession() {
        stopStream(activeMainStream);
        stopStream(activeSecondaryStream);
        stopStream(activePreviewStream);

        activeMainStream = null;
        activeSecondaryStream = null;
        activePreviewStream = null;

        if (audioMixer) {
            audioMixer.cleanup();
            audioMixer = null;
        }
        if (signalingService) {
            signalingService.cleanup();
            signalingService = null;
        }

        await uiManager.cleanup();
        chrome.runtime.sendMessage({ action: C.ACTIONS.CLOSE_TABS });
    }

    function stopStream(stream) {
        if (!stream) return;
        stream.getTracks().forEach((track) => track.stop());
    }

    async function setupTabMirroring(stream, tabId) {
        signalingService = new window.KapturSignalingService();
        signalingService.startConnection(stream);
        const offer = await signalingService.createOffer();
        chrome.runtime.sendMessage({
            action: C.ACTIONS.WEBRTC_OFFER,
            offer,
            targetTabId: tabId || null
        });
    }

    async function acquireMediaStreams(options) {
        let mainStream = null;
        let secondaryStream = null;

        const microphoneSelection = getMicrophoneSelection(options);
        const cameraSelection = getCameraSelection(options, options.type);

        const highQualityConstraints = {
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                sampleRate: 48000
            },
            video: {
                width: { ideal: 1920, max: 3840 },
                height: { ideal: 1080, max: 2160 },
                frameRate: { ideal: 30, max: 30 },
                resizeMode: "none"
            }
        };

        if (options.type === C.SOURCE_TYPE.TAB) {
            await chrome.runtime.sendMessage({ action: C.ACTIONS.OPEN_PLAYBACK_TAB, tabId: null });
            const streamId = await chrome.runtime.sendMessage({ action: "requestStream", tabId: null });
            if (!streamId) throw new Error("Falha ao obter ID da aba.");

            mainStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    mandatory: { chromeMediaSource: "tab", chromeMediaSourceId: streamId }
                },
                video: {
                    mandatory: {
                        chromeMediaSource: "tab",
                        chromeMediaSourceId: streamId,
                        maxWidth: 3840,
                        maxHeight: 2160,
                        maxFrameRate: 30
                    }
                }
            });
        } else if (options.type === C.SOURCE_TYPE.SCREEN) {
            mainStream = await navigator.mediaDevices.getDisplayMedia({
                audio: highQualityConstraints.audio,
                video: { ...highQualityConstraints.video, displaySurface: "monitor" }
            });
        } else if (options.type === C.SOURCE_TYPE.WEBCAM) {
            const videoConstraints = await buildCameraConstraints(cameraSelection, highQualityConstraints.video);
            const audioConstraints = await buildMicrophoneConstraints(microphoneSelection, highQualityConstraints.audio);

            mainStream = await navigator.mediaDevices.getUserMedia({
                video: videoConstraints,
                audio: audioConstraints
            });

            return { mainStream, secondaryStream: null };
        }

        secondaryStream = await acquireMicrophoneStream(microphoneSelection, highQualityConstraints.audio);

        return { mainStream, secondaryStream };
    }

    async function injectWebcam(options, recordingType) {
        const cameraSelection = getCameraSelection(options, recordingType);

        if ((recordingType === C.SOURCE_TYPE.SCREEN || recordingType === C.SOURCE_TYPE.TAB) && cameraSelection.mode !== DEVICE_MODE.NONE) {
            const camStream = await getWebcamStream(cameraSelection);
            if (camStream) {
                activePreviewStream = camStream;
                uiManager.showWebcamPreview(camStream);
            }
        }

        if (recordingType === C.SOURCE_TYPE.WEBCAM) {
            if (activeMainStream) {
                uiManager.showLargeWebcamPreview(activeMainStream);
            } else {
                const camStream = await getWebcamStream(cameraSelection);
                if (camStream) {
                    activePreviewStream = camStream;
                    uiManager.showLargeWebcamPreview(camStream);
                }
            }
        }
    }

    async function getWebcamStream(selection) {
        try {
            const constraints = await buildCameraConstraints(selection, {});
            return await navigator.mediaDevices.getUserMedia({ video: constraints });
        } catch (error) {
            console.warn("[Kaptur Content] Falha ao obter webcam:", error);
            return null;
        }
    }

    async function getAvailableDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return {
            audioInputs: formatDeviceList(devices, "audioinput", "Microfone"),
            videoInputs: formatDeviceList(devices, "videoinput", "Camera")
        };
    }

    function formatDeviceList(devices, kind, genericLabel) {
        let genericIndex = 0;
        return devices
            .filter((device) => device.kind === kind && device.deviceId)
            .map((device) => {
                genericIndex += 1;
                return {
                    deviceId: device.deviceId,
                    label: device.label || `${genericLabel} ${genericIndex}`
                };
            });
    }

    function getMicrophoneSelection(options) {
        if (isSelectionObject(options.microphoneSelection)) {
            return options.microphoneSelection;
        }

        if (options.microfoneId) {
            return {
                mode: DEVICE_MODE.SPECIFIC,
                deviceId: options.microfoneId,
                label: options.microfoneLabel || null
            };
        }

        if (options.microfoneLabel) {
            return {
                mode: DEVICE_MODE.SPECIFIC,
                label: options.microfoneLabel
            };
        }

        return { mode: DEVICE_MODE.NONE };
    }

    function getCameraSelection(options, recordingType) {
        if (isSelectionObject(options.cameraSelection)) {
            if (recordingType === C.SOURCE_TYPE.WEBCAM && options.cameraSelection.mode === DEVICE_MODE.NONE) {
                return { mode: DEVICE_MODE.DEFAULT };
            }
            return options.cameraSelection;
        }

        if (options.webcamId) {
            return {
                mode: DEVICE_MODE.SPECIFIC,
                deviceId: options.webcamId,
                label: options.webcamLabel || null
            };
        }

        if (options.webcamLabel) {
            return {
                mode: DEVICE_MODE.SPECIFIC,
                label: options.webcamLabel
            };
        }

        return recordingType === C.SOURCE_TYPE.WEBCAM ? { mode: DEVICE_MODE.DEFAULT } : { mode: DEVICE_MODE.NONE };
    }

    function isSelectionObject(selection) {
        return selection && typeof selection === "object" && typeof selection.mode === "string";
    }

    async function buildCameraConstraints(selection, baseVideoConstraints) {
        if (!selection || selection.mode === DEVICE_MODE.NONE) {
            throw new Error("Nenhuma camera disponivel para esta acao.");
        }

        if (selection.mode === DEVICE_MODE.DEFAULT) {
            return {
                ...baseVideoConstraints
            };
        }

        const deviceId = await resolveDeviceId(selection, "video");
        return {
            ...baseVideoConstraints,
            deviceId: { exact: deviceId }
        };
    }

    async function buildMicrophoneConstraints(selection, baseAudioConstraints) {
        if (!selection || selection.mode === DEVICE_MODE.NONE) {
            return false;
        }

        const constraints = {
            ...baseAudioConstraints,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
        };

        if (selection.mode === DEVICE_MODE.DEFAULT) {
            return constraints;
        }

        const deviceId = await resolveDeviceId(selection, "audio");
        return {
            ...constraints,
            deviceId: { exact: deviceId }
        };
    }

    async function acquireMicrophoneStream(selection, baseAudioConstraints) {
        const constraints = await buildMicrophoneConstraints(selection, baseAudioConstraints);
        if (!constraints) return null;

        try {
            return await navigator.mediaDevices.getUserMedia({ audio: constraints });
        } catch (error) {
            throw new Error(`Falha ao abrir o microfone selecionado: ${error.message}`);
        }
    }

    async function resolveDeviceId(selection, kind) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const mediaKind = kind === "audio" ? "audioinput" : "videoinput";

        let device = null;
        if (selection.deviceId) {
            device = devices.find((item) => item.kind === mediaKind && item.deviceId === selection.deviceId);
        }

        if (!device && selection.label) {
            device = devices.find((item) => item.kind === mediaKind && item.label === selection.label);
        }

        if (!device) {
            const deviceName = kind === "audio" ? "microfone" : "camera";
            throw new Error(`O ${deviceName} selecionado não foi encontrado nesta página.`);
        }

        return device.deviceId;
    }

    async function checkRecoverySession() {
        if (window.location.href === "about:blank") return;
        try {
            const data = await chrome.storage.local.get("kaptur_rec_state");
            const state = data.kaptur_rec_state;
            if (!state || Date.now() - state.timestamp > 86400000) {
                if (state) chrome.storage.local.remove("kaptur_rec_state");
                return;
            }

            console.log("[Kaptur Content] Recuperando sessao...", state);
            const savedOptions = state.options || {};
            recorderManager.recoverState(state.videoId, state.elapsedSeconds, state.recordingType, savedOptions);
            uiManager.showControls((action) => handleRecoveredUserAction(action));
            setTimeout(async () => {
                uiManager.updateTimer(state.elapsedSeconds);
                uiManager.togglePauseState(true);
                await injectWebcam(savedOptions, state.recordingType);
            }, 1000);
        } catch (error) {
            console.error("Erro rec:", error);
        }
    }

    async function handleRecoveredUserAction(action, inMemoryState) {
        let state = inMemoryState;
        if (!state) {
            const data = await chrome.storage.local.get("kaptur_rec_state");
            state = data.kaptur_rec_state;
            if (!state) return;
        }

        switch (action) {
            case "resume":
                try {
                    await cleanupSession();
                    const savedOptions = state.options || {};
                    savedOptions.type = state.recordingType;
                    const { mainStream, secondaryStream } = await acquireMediaStreams(savedOptions);
                    activeMainStream = mainStream;
                    activeSecondaryStream = secondaryStream;
                    audioMixer = new window.KapturAudioMixer();
                    const streamForRecording = await audioMixer.mix(mainStream, secondaryStream);
                    const onUIReady = async () => { await injectWebcam(savedOptions, state.recordingType); };
                    await recorderManager.start(streamForRecording, savedOptions, () => cleanupSession(), onUIReady, state.videoId);
                    recorderManager.bindActionHandler(null);
                } catch (error) {
                    alert("Erro ao retomar: " + error.message);
                }
                break;
            case "pause":
                uiManager.togglePauseState(true);
                break;
            case C.ACTIONS.STOP_RECORDING:
                recorderManager.stop();
                break;
            case C.ACTIONS.CANCEL_RECORDING:
                recorderManager.cancel();
                break;
        }
    }
})();
