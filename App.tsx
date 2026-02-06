
import React, { useState, useEffect, useRef } from 'react';
import { Nfc, Camera, Wifi, ShieldAlert, CheckCircle2, RefreshCcw, Cpu, ZoomIn, ZoomOut, AlertTriangle, ScanLine, Crosshair, ExternalLink, Zap } from 'lucide-react';
import { analyzeTagVisually } from './services/geminiService';
import { Button } from './components/Button';
import { AppState } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [lastResult, setLastResult] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isIframe, setIsIframe] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanInterval = useRef<number | null>(null);

  useEffect(() => {
    // Detecta se o app está preso em um iframe (causa do erro de NFC)
    setIsIframe(window.self !== window.top);
    
    return () => {
      stopCamera();
      if (autoScanInterval.current) window.clearInterval(autoScanInterval.current);
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (autoScanInterval.current) {
      window.clearInterval(autoScanInterval.current);
      autoScanInterval.current = null;
    }
  };

  const startVisionScan = async () => {
    setAppState(AppState.SCANNING_VISION);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 } }
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      
      // Inicia auto-scan a cada 5 segundos para leitura à distância sem cliques
      autoScanInterval.current = window.setInterval(captureAndAnalyze, 5000);
    } catch (err) {
      setAppState(AppState.ERROR);
      setErrorMsg("Erro ao acessar câmera.");
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    
    setIsCapturing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      try {
        const result = await analyzeTagVisually(base64);
        if (result && result.id) {
          setLastResult(result);
          setAppState(AppState.RESULT);
          stopCamera();
        }
      } catch (err) {
        console.debug("Auto-scan: Nenhuma etiqueta clara detectada.");
      } finally {
        setIsCapturing(false);
      }
    }
  };

  const tryNfcScan = async () => {
    if (!('NDEFReader' in window)) {
      setAppState(AppState.UNSUPPORTED);
      return;
    }

    // Se estiver em iframe, nem tenta para evitar o erro SecurityError travando a UI
    if (isIframe) {
      setAppState(AppState.SECURITY_BLOCKED);
      return;
    }

    try {
      setAppState(AppState.SCANNING_NFC);
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event: any) => {
        setLastResult({
          id: event.serialNumber,
          tagType: "RFID / NFC (HF)",
          visualData: "Leitura via rádio (Hardware de Proximidade)"
        });
        setAppState(AppState.RESULT);
      };
    } catch (err: any) {
      setAppState(AppState.SECURITY_BLOCKED);
    }
  };

  const launchFullApp = () => {
    window.open(window.location.href, '_blank');
  };

  const handleZoom = (val: number) => {
    const newZoom = Math.max(1, Math.min(8, zoom + val));
    setZoom(newZoom);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const caps = track.getCapabilities() as any;
      if (caps.zoom) track.applyConstraints({ advanced: [{ zoom: newZoom }] as any });
    }
  };

  // TELA DE BLOQUEIO NFC (IFRAME)
  if (appState === AppState.SECURITY_BLOCKED || (isIframe && appState === AppState.SCANNING_NFC)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-8 text-center space-y-8">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/20">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-white mb-2 uppercase">RFID BLOQUEADO</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            O navegador não permite ler o chip RFID enquanto o app estiver nesta janela de pré-visualização.
          </p>
        </div>
        <div className="w-full space-y-4">
          <Button onClick={launchFullApp} className="w-full py-6 text-lg bg-blue-600 hover:bg-blue-500">
            <ExternalLink className="w-6 h-6" /> LIBERAR ANTENA RFID
          </Button>
          <Button variant="ghost" onClick={() => setAppState(AppState.IDLE)} className="w-full">
            Voltar ao Início
          </Button>
        </div>
        <p className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">
          A leitura de rádio requer contexto de nível superior
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-white font-sans overflow-hidden">
      <header className="p-4 flex justify-between items-center bg-slate-900 border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Zap className="text-yellow-500 w-5 h-5 fill-yellow-500" />
          <h1 className="font-black text-sm tracking-tighter uppercase">REIS <span className="text-yellow-500">RFID HUB</span></h1>
        </div>
        <button onClick={() => setAppState(AppState.IDLE)} className="p-2 bg-white/5 rounded-lg">
          <RefreshCcw className="w-4 h-4 text-slate-500" />
        </button>
      </header>

      <main className="flex-1 relative flex flex-col items-center justify-center">
        {appState === AppState.IDLE && (
          <div className="p-8 text-center space-y-12 animate-in fade-in zoom-in duration-500">
            <div className="relative mx-auto w-32 h-32">
               <div className="absolute inset-0 bg-yellow-500/20 rounded-full animate-ping opacity-20" />
               <div className="w-full h-full bg-slate-900 rounded-[2.5rem] border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                 <Cpu className="w-14 h-14 text-yellow-500" />
               </div>
            </div>
            
            <div className="space-y-4">
              <Button onClick={tryNfcScan} className="w-full py-6 text-xl rounded-2xl">
                <Nfc className="w-7 h-7" /> LER RFID (RÁDIO)
              </Button>
              <Button onClick={startVisionScan} variant="secondary" className="w-full py-6 text-xl rounded-2xl bg-slate-800">
                <Camera className="w-7 h-7" /> LER À DISTÂNCIA (IA)
              </Button>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl text-left border border-white/5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Status do Sistema</h4>
              <div className="flex items-center gap-2 text-xs text-green-500 font-bold">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                ANTENA PRONTA PARA CAPTURA
              </div>
            </div>
          </div>
        )}

        {appState === AppState.SCANNING_NFC && (
          <div className="flex flex-col items-center text-center space-y-10 animate-in zoom-in">
            <div className="w-56 h-56 bg-yellow-500/5 rounded-full flex items-center justify-center border-4 border-yellow-500/20 relative">
              <div className="absolute inset-0 border-t-4 border-yellow-500 rounded-full animate-spin" />
              <Nfc className="w-24 h-24 text-yellow-500 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Aproximar Tag</h2>
              <p className="text-slate-400 text-sm max-w-[240px] mx-auto">Mantenha a tag encostada na traseira do aparelho por 2 segundos.</p>
            </div>
            <Button variant="ghost" onClick={() => setAppState(AppState.IDLE)}>Cancelar</Button>
          </div>
        )}

        {appState === AppState.SCANNING_VISION && (
          <div className="absolute inset-0 bg-black flex flex-col">
            <video ref={videoRef} autoPlay playsInline muted className="flex-1 object-cover" style={{ transform: `scale(${zoom})` }} />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-72 border-2 border-yellow-500/20 rounded-3xl relative">
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-yellow-500 rounded-tl-3xl" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-yellow-500 rounded-tr-3xl" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-yellow-500 rounded-bl-3xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-yellow-500 rounded-br-3xl" />
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <Crosshair className="w-16 h-16 text-yellow-500" />
                </div>
                {isCapturing && (
                   <div className="absolute inset-0 bg-yellow-500/20 flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                   </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 flex flex-col items-center gap-6">
              <div className="flex items-center gap-10">
                <button onClick={() => handleZoom(-0.5)} className="p-4 bg-white/5 rounded-full"><ZoomOut /></button>
                <div className="text-center">
                   <p className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-widest">Auto-Scan Ativo</p>
                   <p className="text-2xl font-black font-mono text-yellow-500">{zoom.toFixed(1)}x</p>
                </div>
                <button onClick={() => handleZoom(0.5)} className="p-4 bg-white/5 rounded-full"><ZoomIn /></button>
              </div>
              <p className="text-xs text-slate-400 text-center max-w-[250px]">
                Aponte para a antena RFID. A IA está tentando ler automaticamente a cada 5 segundos.
              </p>
              <Button onClick={() => { stopCamera(); setAppState(AppState.IDLE); }} variant="secondary" className="w-full">
                Encerrar Câmera
              </Button>
            </div>
          </div>
        )}

        {appState === AppState.RESULT && lastResult && (
          <div className="w-full max-w-sm p-6 space-y-6 animate-in slide-in-from-bottom-10">
            <div className="bg-slate-900 border border-white/10 rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl" />
              
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Tag Identificada</h4>
                  <p className="text-4xl font-mono font-black text-yellow-500 tracking-tighter">{lastResult.id}</p>
                </div>
                <div className="bg-green-500/20 p-4 rounded-[1.5rem] text-green-400 shadow-lg shadow-green-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Detalhes Técnicos</p>
                  <p className="text-sm font-bold text-white mb-1 uppercase tracking-tight">{lastResult.tagType}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed italic">{lastResult.visualData}</p>
                </div>
              </div>
            </div>

            <Button onClick={() => setAppState(AppState.IDLE)} className="w-full h-16 text-lg rounded-3xl">
              Próxima Leitura
            </Button>
          </div>
        )}
      </main>

      <canvas ref={canvasRef} className="hidden" />
      <footer className="p-4 bg-slate-900/50 text-center">
        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.4em]">REIS INDUSTRIAL HUB &bull; RFID ENGINE v5.0</p>
      </footer>
    </div>
  );
};

export default App;
