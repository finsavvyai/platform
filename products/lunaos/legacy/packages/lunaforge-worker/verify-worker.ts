
// Mock Request/Response global objects if they don't exist (Node environment)
if (!globalThis.Response) {
    globalThis.Response = class Response {
        constructor(public body: any, public init?: any) { }
        headers = { get: () => null };
        status = 200;
        json() { return Promise.resolve(JSON.parse(this.body)); }
        text() { return Promise.resolve(this.body); }
    } as any;
}
if (!globalThis.Request) {
    globalThis.Request = class Request {
        constructor(public url: string, public init?: any) {
            this.method = init?.method || 'GET';
        }
        method: string;
        json() { return Promise.resolve(JSON.parse(this.init.body)); }
    } as any;
}

import worker from "./src/index.js";

async function main() {
    console.log("Testing LunaForge Worker...");

    // 1. Construct a JSON-RPC Request to call 'lunaforge_analyze_content'
    const rpcRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
            name: "lunaforge_analyze_content",
            arguments: {
                content: "import { foo } from 'bar';\nexport class Baz {}",
                filePath: "test.ts"
            }
        }
    };

    const req = new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify(rpcRequest)
    });

    try {
        const res = await worker.fetch(req, {}, {});
        const body = await res.text(); // Get raw text to inspect

        console.log("Response Status:", res.status);
        console.log("Response Body:", body);

        const json = JSON.parse(body);
        if (json.error) {
            console.error("RPC Error:", json.error);
            process.exit(1);
        }

        // Verify Content
        const contentStr = json.result.content[0].text;
        const analysis = JSON.parse(contentStr);

        if (analysis.metrics.classCount === 1) {
            console.log("SUCCESS: Found 1 class as expected.");
        } else {
            console.error("FAILURE: Expected 1 class, found", analysis.metrics.classCount);
            process.exit(1);
        }

    } catch (e) {
        console.error("Test Failed:", e);
        process.exit(1);
    }
}

main();
