export class WorkerClient {
  base: string;

  constructor(opts: any = {}) {
    // Always safe
    this.base = (opts.workerUrl ?? "http://mock").replace(/\/$/, "");
  }

  async call(method: string, payload: any) {
    return { ok: true, method, payload };
  }
}