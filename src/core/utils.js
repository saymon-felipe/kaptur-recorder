(function () {
    /**
     * KapturUtils - Biblioteca de utilitários globais da extensão.
     */
    window.KapturUtils = {
        
        sleep: (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        nextFrame: () => {
            return new Promise(resolve => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(resolve);
                });
            });
        },

        formatTime: (totalSeconds) => {
            const hrs = Math.floor(totalSeconds / 3600);
            const mins = Math.floor((totalSeconds % 3600) / 60);
            const secs = Math.floor(totalSeconds % 60);

            const pad = (num) => String(num).padStart(2, '0');
            return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
        },

        generateUUID: () => {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        },

        blobToBase64: (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (reader.result) {
                        const base64 = reader.result.toString().split(',')[1];
                        resolve(base64);
                    } else {
                        reject(new Error("Falha ao converter Blob para Base64"));
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        },

        generateFileName: (prefix = "kaptur-recorder") => {
            const now = new Date();
            const date = now.toLocaleDateString("en-CA"); 
            const time = now.toTimeString().slice(0, 5).replace(":", "-"); 
            return `${prefix}-${date}_${time}`;
        },

        truncateText: (text, limit = 40) => {
            if (!text) return "";
            return text.length > limit ? text.slice(0, limit) + "..." : text;
        },

        isExtensionContextInvalid: () => {
            return !chrome.runtime?.id;
        }
    };
})();