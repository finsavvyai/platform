# Awesome Self-Hosted — PR draft

**Target repo:** https://github.com/awesome-selfhosted/awesome-selfhosted
**Section heading:** `## Software Development` → subsection `### Artificial Intelligence` or `### API Gateways`.
**Maintainer pre-approval required:** **Yes** — awesome-selfhosted has strict rules: software must be open-source AND self-hostable. ClawPipe is partially eligible: the **SDK is MIT/OSS and self-installable**, but the **gateway is hosted SaaS, not self-hostable today**. Recommended path: open an issue first asking whether an SDK-only entry is acceptable (some projects in the list have similar scope). If yes, proceed; if no, defer until gateway open-sources or a self-host bundle ships. Do not submit a straight PR — it will be rejected.

## Line to add (only if maintainer approves SDK-only scope)

```
- [ClawPipe SDK](https://www.npmjs.com/package/clawpipe-ai) `MIT` `Nodejs` - Open-source SDK for the ClawPipe AI optimization pipeline. Runs Booster, Packer, and local cache stages in-process; gateway is hosted SaaS.
```

## PR description (paste-ready, 2 sentences)

Proposes adding the ClawPipe SDK (MIT-licensed, npm) to the AI section, with an honest note that the gateway component is hosted SaaS rather than self-hostable. The SDK alone is useful self-hosted because Booster + Packer + local cache run entirely in-process and can be combined with any OpenAI-compatible endpoint (including local Ollama/llamafile).
