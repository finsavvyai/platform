export const reasons = [
  { icon: '0', title: '$0 forever', desc: 'Runs on your machine. No cloud bills. GitHub Actions charges $0.008/min — that adds up fast.' },
  { icon: '30', title: '30-second setup', desc: 'npx pushci init. AI detects your stack, generates pipeline. No YAML, no docs, no DevOps degree needed.' },
  { icon: '35', title: '35 languages', desc: 'Go, Node, Python, Rust, Java, C#, Ruby, PHP, Swift, Dart, Elixir, Zig, Kotlin, Scala, Haskell, Clojure, OCaml, Nim, Crystal, Gleam, Deno, Bun, Lua, Perl, R, Julia, V, Erlang, Solidity, Terraform, Helm, Fortran, Bicep, and more. Auto-detected.' },
  { icon: 'AI', title: 'AI-native', desc: 'Built-in MCP server for Claude Code, Cursor, Windsurf. Self-healing pipelines. Root cause analysis.' },
  { icon: '3', title: '3 platforms', desc: 'GitHub, GitLab, AND Bitbucket. One config. No vendor lock-in.' },
  { icon: '22', title: '22 deploy targets', desc: 'AWS (ECS/Lambda/S3), GCP (Cloud Run/App Engine), Azure (App Service/Functions/Bicep), Cloudflare Pages/Workers, Vercel, Netlify, Fly.io, Railway, Render, Docker, Kubernetes, SSH, Terraform, CloudFormation, Pulumi, Ansible. Built-in.' },
]

export const faqs = [
  { q: 'Is PushCI really free?', a: 'Yes. The free tier includes 1 repo with unlimited local runs. Pro ($9/mo) adds unlimited repos and analytics. Team ($29/mo) adds shared runners and SSO.' },
  { q: 'How is PushCI different from GitHub Actions?', a: 'PushCI requires zero YAML, runs locally for free, uses AI to auto-detect your stack, and works with GitHub, GitLab, AND Bitbucket. Setup is 30 seconds vs 30+ minutes.' },
  { q: 'Can my AI coding agent use PushCI?', a: 'Yes. PushCI has a built-in MCP server. Add it to Claude Code, Cursor, or Windsurf and say "set up CI for this project".' },
  { q: 'What if my pipeline breaks?', a: 'PushCI has AI-powered self-healing. It detects the root cause, suggests fixes, and can auto-apply patches.' },
  { q: 'Do I need to migrate from GitHub Actions?', a: 'PushCI can convert your existing GitHub Actions YAML to PushCI format automatically. Run npx pushci init and it handles the rest.' },
]
