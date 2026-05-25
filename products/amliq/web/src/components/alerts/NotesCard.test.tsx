import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NotesCard } from './NotesCard'

// ─── SpeechRecognition mock factory ─────────────────────────────────────────
//
// NotesCard reads `window.SpeechRecognition` once at module-evaluation time
// and stores it in the module-level constant `SR`.  Because the module is
// already loaded by the time these tests run, we can NOT change the SR
// constant between tests.  Instead:
//
//  • For "absent" tests  → ensure window.SpeechRecognition is undefined at
//    module load time (the default in jsdom).  The mic button will not render.
//
//  • For "present" tests → we need to trick the module.  We use
//    `vi.resetModules()` + a dynamic `await import(...)` inside each test so
//    NotesCard is re-evaluated with the mock already in place.

function removeSpeechRecognition() {
  delete (window as unknown as Record<string, unknown>).SpeechRecognition
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition
}

// Creates a recognition instance whose callbacks are externally accessible.
// Returns both the constructor mock and the *latest* instance created.
function buildSRMock() {
  let latestInstance: ReturnType<typeof makeInstance>

  function makeInstance() {
    return {
      lang: '',
      interimResults: false,
      onresult: null as ((e: unknown) => void) | null,
      onend: null as (() => void) | null,
      start: vi.fn(),
      stop: vi.fn(),
    }
  }

  const ctor = vi.fn(() => {
    latestInstance = makeInstance()
    return latestInstance
  })

  ;(window as unknown as Record<string, unknown>).SpeechRecognition = ctor

  return {
    ctor,
    // Proxy so callers always see the most-recently-created instance.
    get instance() {
      return latestInstance
    },
  }
}

// ─── Tests where SpeechRecognition is ABSENT (uses the already-imported module)

describe('NotesCard', () => {
  beforeEach(() => removeSpeechRecognition())
  afterEach(() => removeSpeechRecognition())

  it('renders textarea with notes value', () => {
    render(<NotesCard notes="Existing notes" onNotesChange={vi.fn()} />)
    expect(screen.getByDisplayValue('Existing notes')).toBeInTheDocument()
  })

  it('renders empty textarea when notes empty', () => {
    render(<NotesCard notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('calls onNotesChange when typing', async () => {
    const handler = vi.fn()
    render(<NotesCard notes="" onNotesChange={handler} />)
    await userEvent.type(screen.getByRole('textbox'), 'new note')
    expect(handler).toHaveBeenCalled()
  })

  it('renders save button', () => {
    render(<NotesCard notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /save notes/i })).toBeInTheDocument()
  })

  it('has accessible label on textarea', () => {
    render(<NotesCard notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByLabelText(/investigation notes/i)).toBeInTheDocument()
  })

  it('renders title heading', () => {
    render(<NotesCard notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByText(/investigation notes/i)).toBeInTheDocument()
  })

  it('does not render mic button when SpeechRecognition is unavailable', () => {
    render(<NotesCard notes="" onNotesChange={vi.fn()} />)
    expect(
      screen.queryByRole('button', { name: /dictation/i }),
    ).not.toBeInTheDocument()
  })
})

// ─── Tests where SpeechRecognition IS PRESENT (fresh module per test) ────────
//
// We call vi.resetModules() then dynamically import NotesCard so the module
// constant SR is evaluated with window.SpeechRecognition already set.

describe('NotesCard – dictation (SpeechRecognition available)', () => {
  let sr: ReturnType<typeof buildSRMock>
  let FreshNotesCard: typeof NotesCard

  beforeEach(async () => {
    vi.resetModules()
    sr = buildSRMock()
    const mod = await import('./NotesCard')
    FreshNotesCard = mod.NotesCard
  })

  afterEach(() => {
    removeSpeechRecognition()
    vi.resetModules()
  })

  it('renders mic button when SpeechRecognition is available', () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Start dictation' }),
    ).toBeInTheDocument()
  })

  it('starts recording and shows stop label when mic button clicked', async () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))

    expect(sr.instance.start).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Stop dictation' }),
    ).toBeInTheDocument()
  })

  it('stops recognition when stop button clicked', async () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    await userEvent.click(screen.getByRole('button', { name: 'Stop dictation' }))

    expect(sr.instance.stop).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('button', { name: 'Start dictation' }),
    ).toBeInTheDocument()
  })

  it('appends transcript to existing notes via onNotesChange', async () => {
    const handler = vi.fn()
    render(<FreshNotesCard notes="Existing note." onNotesChange={handler} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))

    act(() => {
      sr.instance.onresult!({
        results: [[{ transcript: 'new transcript' }]],
      })
    })

    expect(handler).toHaveBeenCalledWith('Existing note. new transcript')
  })

  it('sets transcript directly when notes is empty', async () => {
    const handler = vi.fn()
    render(<FreshNotesCard notes="" onNotesChange={handler} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))

    act(() => {
      sr.instance.onresult!({
        results: [[{ transcript: 'hello world' }]],
      })
    })

    expect(handler).toHaveBeenCalledWith('hello world')
  })

  it('resets recording state when recognition ends', async () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))
    expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeInTheDocument()

    act(() => {
      sr.instance.onend!()
    })

    expect(
      screen.getByRole('button', { name: 'Start dictation' }),
    ).toBeInTheDocument()
  })

  it('sets recognition language from i18n', async () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))

    // i18n is initialised via setup.ts → i18n/config; language will be 'en'
    expect(sr.instance.lang).toBe('en')
  })

  it('sets interimResults to false', async () => {
    render(<FreshNotesCard notes="" onNotesChange={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Start dictation' }))

    expect(sr.instance.interimResults).toBe(false)
  })
})
