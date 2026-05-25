package server

import (
	"context"
	"log"
	"sync"

	"github.com/finsavvyai/pushci/internal/actions"
	"github.com/finsavvyai/pushci/internal/platform"
)

// actionsStatusPoster consumes events from the actions runner and posts
// one GitHub status per job. Context name: `pushci/actions/<job-id>`.
// Status calls happen in the consumer goroutine; failures are logged
// but swallowed so a stuck GitHub API can't block the pipeline.
type actionsStatusPoster struct {
	ctx      context.Context
	provider platform.Provider
	event    *platform.Event

	// seen prevents double-posting on matrix/repeated start events.
	seen map[string]bool
}

// newActionsStatusPoster constructs a poster bound to a provider and
// event. Callers run it via stream() with a populated channel.
func newActionsStatusPoster(ctx context.Context, p platform.Provider, e *platform.Event) *actionsStatusPoster {
	return &actionsStatusPoster{
		ctx:      ctx,
		provider: p,
		event:    e,
		seen:     make(map[string]bool),
	}
}

// stream reads events until the channel closes and posts statuses as
// they come in. The returned WaitGroup is Done when stream drains, so
// callers can wait for the poster to finish before returning.
func (p *actionsStatusPoster) stream(events <-chan actions.Event, wg *sync.WaitGroup) {
	defer wg.Done()
	for ev := range events {
		switch ev.Kind {
		case actions.EventStepStart, actions.EventJobStart:
			if ev.Job != "" {
				p.postPending(ev.Job)
			}
		case actions.EventJobComplete:
			if ev.Job != "" {
				p.postTerminal(ev.Job, isSuccessMessage(ev.Message))
			}
		}
	}
}

// postPending posts a single "pending" status for a job on its first
// observed start event. Subsequent start events for the same job are
// no-ops thanks to the seen map.
func (p *actionsStatusPoster) postPending(job string) {
	if p.seen[job] {
		return
	}
	p.seen[job] = true
	p.post(job, platform.StatePending, "Running...")
}

// postTerminal posts the final success/failure status for a job.
func (p *actionsStatusPoster) postTerminal(job string, ok bool) {
	state := platform.StateSuccess
	desc := "Job passed"
	if !ok {
		state = platform.StateFailure
		desc = "Job failed"
	}
	p.post(job, state, desc)
}

// post is the single HTTP boundary. Errors are logged but swallowed
// because a failing GitHub API must not block the pipeline.
func (p *actionsStatusPoster) post(job string, state platform.State, desc string) {
	ctxName := "pushci/actions/" + job
	if p.provider == nil || p.event == nil {
		return
	}
	err := p.provider.PostStatus(p.ctx, p.event, &platform.Status{
		SHA:         p.event.SHA,
		State:       state,
		Context:     ctxName,
		Description: desc,
	})
	if err != nil {
		log.Printf("[actions-status] %s %s: %v", ctxName, state, err)
	}
}
