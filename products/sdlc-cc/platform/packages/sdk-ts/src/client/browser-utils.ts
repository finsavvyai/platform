// Browser info and utility functions for the Browser SDLC Client

export interface BrowserInfo {
  userAgent: string;
  language: string;
  languages: string[];
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: string | null;
  onLine: boolean;
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelDepth: number;
  };
  viewport: {
    width: number;
    height: number;
  };
  timezone: string;
  timezoneOffset: number;
}

/**
 * Collect browser environment information.
 */
export function getBrowserInfo(): BrowserInfo {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: Array.from(navigator.languages),
    platform: navigator.platform,
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    onLine: navigator.onLine,
    screen: {
      width: screen.width,
      height: screen.height,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset()
  };
}

export interface DragAndDropOptions {
  onDrop?: (files: File[]) => void;
  onDragEnter?: (event: DragEvent) => void;
  onDragLeave?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  acceptedTypes?: string[];
  maxFiles?: number;
  maxFileSize?: number;
}

/**
 * Attach drag-and-drop handlers to an element.
 * Returns a cleanup function that removes all listeners.
 */
export function setupDragAndDrop(
  element: HTMLElement,
  options: DragAndDropOptions = {}
): () => void {
  const {
    onDrop,
    onDragEnter,
    onDragLeave,
    onDragOver,
    acceptedTypes = [],
    maxFiles = 10,
    maxFileSize = 100 * 1024 * 1024
  } = options;

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragEnter) onDragEnter(e);
    element.classList.add('drag-over');
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragLeave) onDragLeave(e);
    element.classList.remove('drag-over');
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragOver) onDragOver(e);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    element.classList.remove('drag-over');

    const files = Array.from(e.dataTransfer?.files || []);
    const validFiles = files.filter(file => {
      if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
        return false;
      }
      return file.size <= maxFileSize;
    });

    const limitedFiles = validFiles.slice(0, maxFiles);
    if (onDrop) onDrop(limitedFiles);
  };

  element.addEventListener('dragenter', handleDragEnter);
  element.addEventListener('dragleave', handleDragLeave);
  element.addEventListener('dragover', handleDragOver);
  element.addEventListener('drop', handleDrop);

  return () => {
    element.removeEventListener('dragenter', handleDragEnter);
    element.removeEventListener('dragleave', handleDragLeave);
    element.removeEventListener('dragover', handleDragOver);
    element.removeEventListener('drop', handleDrop);
  };
}
