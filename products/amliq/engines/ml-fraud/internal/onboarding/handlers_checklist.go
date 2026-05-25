package onboarding

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// GetChecklist returns the integration checklist for a session
// (GET /onboarding/:id/checklist).
func (h *OnboardingHandler) GetChecklist(c *gin.Context) {
	id := c.Param("id")

	cl, err := h.repo.GetChecklist(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cl)
}

// CompleteChecklistItem marks a checklist item as complete by name
// (POST /onboarding/:id/checklist/:item).
func (h *OnboardingHandler) CompleteChecklistItem(c *gin.Context) {
	id := c.Param("id")
	itemName := c.Param("item")

	cl, err := h.repo.GetChecklist(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	found := false
	now := time.Now().UTC()
	for i := range cl.Items {
		if cl.Items[i].Name == itemName {
			cl.Items[i].Completed = true
			cl.Items[i].VerifiedAt = &now
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusBadRequest, gin.H{"error": "checklist item not found"})
		return
	}

	cl.UpdateCompletion()

	if err := h.repo.SaveChecklist(c.Request.Context(), cl); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cl)
}
