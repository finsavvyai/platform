// Type declarations for modules used by dependencies
// but not available in Cloudflare Workers types

declare module 'events' {
    class EventEmitter {
        addListener(event: string | symbol, listener: (...args: any[]) => void): this;
        on(event: string | symbol, listener: (...args: any[]) => void): this;
        once(event: string | symbol, listener: (...args: any[]) => void): this;
        removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
        off(event: string | symbol, listener: (...args: any[]) => void): this;
        removeAllListeners(event?: string | symbol): this;
        setMaxListeners(n: number): this;
        getMaxListeners(): number;
        listeners(event: string | symbol): Function[];
        rawListeners(event: string | symbol): Function[];
        emit(event: string | symbol, ...args: any[]): boolean;
        listenerCount(event: string | symbol): number;
        prependListener(event: string | symbol, listener: (...args: any[]) => void): this;
        prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this;
        eventNames(): Array<string | symbol>;
    }
    export = EventEmitter;
    export { EventEmitter };
}

// Node.js built-in module stubs needed by @lunaos/rag transitive dependencies
// These modules are not used at runtime in Workers, only for type resolution
declare module 'fs' {
    export const promises: {
        readFile(path: string, encoding: string): Promise<string>;
        readdir(path: string, options?: any): Promise<any[]>;
        stat(path: string): Promise<any>;
        access(path: string): Promise<void>;
        writeFile(path: string, data: any): Promise<void>;
    };
    export function readFileSync(path: string, encoding?: string): string;
    export function existsSync(path: string): boolean;
}

declare module 'path' {
    export function join(...paths: string[]): string;
    export function resolve(...paths: string[]): string;
    export function extname(path: string): string;
    export function basename(path: string, ext?: string): string;
    export function dirname(path: string): string;
    export function relative(from: string, to: string): string;
    export const sep: string;
}

declare var Buffer: {
    from(str: string, encoding?: string): { toString(encoding: string): string };
    isBuffer(obj: any): boolean;
};

declare var require: (id: string) => any;
