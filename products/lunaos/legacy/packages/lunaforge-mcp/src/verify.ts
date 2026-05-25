import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
    console.log("Starting LunaForge MCP verification...");

    const transport = new StdioClientTransport({
        command: "node",
        args: ["./dist/index.js"],
    });

    const client = new Client(
        {
            name: "lunaforge-verification-client",
            version: "1.0.0",
        },
        {
            capabilities: {},
        }
    );

    try {
        console.log("Connecting to server...");
        await client.connect(transport);
        console.log("Connected.");

        console.log("Listing tools...");
        const tools = await client.listTools();
        console.log("Tools found:", tools.tools.map((t) => t.name));

        if (!tools.tools.find((t) => t.name === "lunaforge_get_stats")) {
            throw new Error("lunaforge_get_stats tool not found!");
        }

        console.log("Calling lunaforge_get_stats...");
        const result = await client.callTool({
            name: "lunaforge_get_stats",
            arguments: {},
        });

        console.log("Result:", JSON.stringify(result, null, 2));
        console.log("Verification SUCCESS");
    } catch (error) {
        console.error("Verification FAILED:", error);
        process.exit(1);
    } finally {
        // Only close if method exists, otherwise just exit
        // client.close(); 
        process.exit(0);
    }
}

main();
