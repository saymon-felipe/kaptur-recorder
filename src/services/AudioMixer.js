/**
 * AudioMixer - Serviço de Mixagem de Áudio.
 * Utiliza a Web Audio API para combinar múltiplos streams de áudio (ex: som do sistema + microfone)
 * em uma única trilha de áudio para a gravação final.
 */
(function () {
    class AudioMixer {
        constructor() {
            this.audioContext = null;
            this.sources = [];
            this.destination = null;
        }

        mix(baseStream, secondaryStream) {
            if (!secondaryStream) {
                return baseStream;
            }

            const baseAudioTracks = baseStream.getAudioTracks();
            
            if (baseAudioTracks.length === 0) {
                return new MediaStream([
                    ...baseStream.getVideoTracks(),
                    ...secondaryStream.getAudioTracks()
                ]);
            }

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.destination = this.audioContext.createMediaStreamDestination();

            if (baseAudioTracks.length > 0) {
                const source1 = this.audioContext.createMediaStreamSource(baseStream);
                source1.connect(this.destination);
                this.sources.push(source1);
            }

            const secAudioTracks = secondaryStream.getAudioTracks();
            if (secAudioTracks.length > 0) {
                const source2 = this.audioContext.createMediaStreamSource(secondaryStream);
                source2.connect(this.destination);
                this.sources.push(source2);
            }

            const mixedStream = new MediaStream([
                ...baseStream.getVideoTracks(),
                ...this.destination.stream.getAudioTracks()
            ]);

            return mixedStream;
        }

        cleanup() {
            if (this.audioContext) {
                this.audioContext.close().catch(e => console.warn("Erro ao fechar AudioContext:", e));
                this.audioContext = null;
            }
            this.sources = [];
            this.destination = null;
        }
    }

    window.KapturAudioMixer = AudioMixer;
})();