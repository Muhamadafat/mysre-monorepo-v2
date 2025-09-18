// webgazer.d.ts

declare module 'webgazer' {
  interface GazeListenerData {
    x: number;
    y: number;
  }

  const webgazer: {
    begin: () => Promise<void>;
    end: () => any;
    setGazeListener: (listener: (data: GazeListenerData | null, elapsedTime: number) => void) => any;
    showPredictionPoints: (show: boolean) => any;
    showVideo: (show: boolean) => any;
    showFaceOverlay: (show: boolean) => any;
    showFaceFeedbackBox: (show: boolean) => any;
  };

  export default webgazer;
}