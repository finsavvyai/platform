/**
 * Web Speech API type declarations
 * (not yet in TypeScript's lib.dom.d.ts for all environments)
 */

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    grammars: SpeechGrammarList;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onaudioend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  var SpeechRecognition: {
    prototype: SpeechRecognition;
    new(): SpeechRecognition;
  };

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  interface SpeechGrammarList extends EventTarget {
    length: number;
    addFromString(string: string): void;
    addFromURI(src: string): void;
    item(index: number): SpeechGrammar;
    [index: number]: SpeechGrammar;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }
}

export {};
