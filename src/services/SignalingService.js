/**
 * SignalingService - WebRTC Sender.
 * Responsável por estabelecer uma conexão Peer-to-Peer (P2P) local entre o Content Script e a Aba de Playback.
 */
(function () {
    const C = window.KapturConstants;

    class SignalingService {
        constructor() {
            this.pc = null;
            this.localStream = null;
        }

        startConnection(stream) {
            this.localStream = stream;
            
            const configuration = {
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            };

            this.pc = new RTCPeerConnection(configuration);

            stream.getTracks().forEach(track => {
                this.pc.addTrack(track, stream);
            });

            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    chrome.runtime.sendMessage({ 
                        action: C.ACTIONS.WEBRTC_CANDIDATE, 
                        candidate: JSON.parse(JSON.stringify(event.candidate)) 
                    });
                }
            };
        }

        async createOffer() {
            if (!this.pc) throw new Error("PeerConnection não inicializada.");

            try {
                const offer = await this.pc.createOffer();
                await this.pc.setLocalDescription(offer);
                return offer;
            } catch (error) {
                console.error("SignalingService: Erro ao criar oferta WebRTC:", error);
                throw error;
            }
        }

        async handleAnswer(answer) {
            if (!this.pc) return;

            try {
                if (this.pc.signalingState === 'have-local-offer') {
                    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
                } else {
                    console.warn("SignalingService: Estado inválido para setRemoteDescription:", this.pc.signalingState);
                }
            } catch (error) {
                console.error("SignalingService: Erro ao definir resposta remota:", error);
            }
        }

        async handleCandidate(candidate) {
            if (!this.pc) return;

            try {
                await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error("SignalingService: Erro ao adicionar candidato ICE:", error);
            }
        }

        cleanup() {
            if (this.pc) {
                this.pc.close();
                this.pc = null;
            }
            this.localStream = null;
        }
    }

    window.KapturSignalingService = SignalingService;

})();