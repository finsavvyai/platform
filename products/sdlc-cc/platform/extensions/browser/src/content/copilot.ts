// SPDX-License-Identifier: AGPL-3.0-or-later
import { bindEditor } from "./shared";

bindEditor({
  surface: "copilot",
  selector: "textarea#userInput, div[contenteditable='true'][role='textbox']",
  submitSelectors: [
    "button[data-testid='submit-button']",
    "button[aria-label='Submit message']",
    "button[type='submit']",
  ],
  submitKeys: [{ key: "Enter" }],
});
