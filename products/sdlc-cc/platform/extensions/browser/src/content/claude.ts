// SPDX-License-Identifier: AGPL-3.0-or-later
import { bindEditor } from "./shared";

bindEditor({
  surface: "claude",
  selector: "div.ProseMirror[contenteditable='true']",
  submitSelectors: [
    "button[aria-label='Send Message']",
    "button[aria-label='Send message']",
    "button[data-testid='send-button']",
  ],
  submitKeys: [{ key: "Enter" }],
});
