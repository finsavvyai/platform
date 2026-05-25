// SPDX-License-Identifier: AGPL-3.0-or-later
import { bindEditor } from "./shared";

bindEditor({
  surface: "gemini",
  selector: "div.ql-editor[contenteditable='true'], rich-textarea div[contenteditable='true']",
  submitSelectors: [
    "button[aria-label='Send message']",
    "button.send-button",
  ],
  submitKeys: [{ key: "Enter" }],
});
