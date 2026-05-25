package ui

import (
	"context"
	"testing"
	"time"

	"finsavvyai-desktop/config"
	"finsavvyai-desktop/services"
)

func TestRunMonitoringTick_Success(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	// Register a client to receive broadcasts
	client := &services.WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	ctx := context.Background()

	// Run the tick in a goroutine since Broadcast may block briefly
	go runMonitoringTick(ctx, clusterSvc, hub, logger)

	// Should have received at least one broadcast (status or metrics)
	received := 0
	timeout := time.After(2 * time.Second)
	for received < 2 {
		select {
		case <-client.Send:
			received++
		case <-timeout:
			goto done
		}
	}
done:
	if received < 1 {
		t.Errorf("received %d broadcasts, want at least 1", received)
	}
}

func TestRunMonitoringTick_CancelledContext(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	// Should not panic with cancelled context
	runMonitoringTick(ctx, clusterSvc, hub, logger)
}

func TestStartSystemMonitoringWithCtx_Cancellation(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		startSystemMonitoringWithCtx(ctx, clusterSvc, hub, logger, 10*time.Millisecond)
		close(done)
	}()

	// Let it run a few ticks
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// goroutine exited cleanly
	case <-time.After(2 * time.Second):
		t.Error("monitoring did not stop after context cancel")
	}
}

func TestStartSystemMonitoringWithCtx_TickFires(t *testing.T) {
	cfg := config.Default()
	logger := newTestLogger()

	clusterSvc := services.NewClusterService(cfg, logger)
	hub := services.NewWSHub(logger)
	go hub.Run()

	client := &services.WSClient{
		Send:   make(chan []byte, 256),
		Hub:    hub,
		Logger: logger,
	}
	hub.Register(client)
	time.Sleep(50 * time.Millisecond)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go startSystemMonitoringWithCtx(ctx, clusterSvc, hub, logger, 20*time.Millisecond)

	// Wait for at least one tick
	select {
	case <-client.Send:
		// received a broadcast from monitoring tick
	case <-time.After(1 * time.Second):
		t.Error("no broadcast received from monitoring")
	}
}
