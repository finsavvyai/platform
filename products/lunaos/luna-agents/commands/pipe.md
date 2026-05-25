---
name: pipe
displayName: Pipeline Runner (shortcut)
description: "Shortcut: Luna's AI programming language — compose commands with operators -> /ll-pipe"
version: 2.0.0
category: workflow
shortcut_for: ll-pipe
---

# /pipe — Luna's AI Programming Language

Shortcut for `/ll-pipe`.

```
/pipe req >> des >> plan >> go *5 >> rev >> test >> ship
/pipe (rev ~~ test ~~ sec) ?>> ship !>> fix
/pipe @before:rules @after:test go *5 >> assert $test.coverage >= 90 >> pr
/pipe try (go >> test >> ship) catch (rollback) finally (docs)
/pipe def qg = (rev ~~ test ~~ sec) >> run qg ?>> ship
/pipe watch src/ >> test >> rev
```
