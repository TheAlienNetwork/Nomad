import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type SpeechCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function webSpeechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function appendSpoken(base: string, spoken: string): string {
  const next = spoken.trim();
  if (!next) return base;
  if (!base.trim()) return next;
  const glue = base.endsWith(' ') || base.endsWith('\n') ? '' : ' ';
  return `${base}${glue}${next}`;
}

export function useDictation(getText: () => string, setText: (value: string) => void) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechCtor> | null>(null);
  const committedRef = useRef('');
  const getTextRef = useRef(getText);
  const setTextRef = useRef(setText);
  getTextRef.current = getText;
  setTextRef.current = setText;

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  };

  const toggle = () => {
    if (listening) {
      stop();
      return;
    }
    if (Platform.OS !== 'web') {
      setUnsupported('Dictation unavailable on this device');
      return;
    }
    const Ctor = webSpeechCtor();
    if (!Ctor) {
      setUnsupported('Dictation unavailable in this browser');
      return;
    }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    committedRef.current = getTextRef.current();
    recognition.onresult = (event) => {
      let finalChunk = '';
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result) continue;
        if (result.isFinal) finalChunk += result[0].transcript;
        else interim += result[0].transcript;
      }
      if (finalChunk) {
        committedRef.current = appendSpoken(committedRef.current, finalChunk);
      }
      setTextRef.current(appendSpoken(committedRef.current, interim));
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setUnsupported('Dictation unavailable — microphone permission denied.');
      }
      stop();
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setUnsupported(null);
  };

  return { listening, unsupported, toggle };
}
