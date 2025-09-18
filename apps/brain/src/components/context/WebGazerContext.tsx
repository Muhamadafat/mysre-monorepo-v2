"use client";

import { createContext, useContext } from 'react';

interface WebGazerContextType {
    isSessionActive: boolean;
    startSession: () => void;
    stopSession: () => void;
}

const WebGazerContext = createContext<WebGazerContextType>({
    isSessionActive: false,
    startSession: () => console.warn('startEyeTracking function not yet initialized'),
    stopSession: () => console.warn('stopEyeTracking function not yet initialized')
});

export const useWebGazer = () => {
    return useContext(WebGazerContext);
}

export default WebGazerContext;