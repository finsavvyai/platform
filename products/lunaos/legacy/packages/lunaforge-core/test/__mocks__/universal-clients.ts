export class MockClient {
  base: string;

  constructor(opts: any = {}) {
    this.base = (opts.workerUrl ?? opts.backendUrl ?? "http://mock").replace(/\/$/, "");
  }

  async call(method: string, payload: any) {
    return { ok: true, method, payload };
  }
}