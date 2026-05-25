// SPDX-License-Identifier: AGPL-3.0-or-later
import { bindEditor } from "./shared";

bindEditor({
  surface: "chatgpt",
  selector: "div#prompt-textarea[contenteditable='true'], textarea#prompt-textarea",
  submitSelectors: [
    "button[data-testid='send-button']",
    "button[aria-label='Send prompt']",
    "button[aria-label='Send message']",
  ],
  submitKeys: [{ key: "Enter" }],
});
