package adapter

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
	"github.com/queryflux/backend/internal/service"
)

type SavedQueryHandler struct {
	svc *service.SavedQueryService
}

func NewSavedQueryHandler(svc *service.SavedQueryService) *SavedQueryHandler {
	return &SavedQueryHandler{svc: svc}
}

func (h *SavedQueryHandler) RegisterRoutes(group *gin.RouterGroup) {
	q := group.Group("/queries")
	{
		q.POST("", h.create)
		q.GET("", h.list)
		q.GET("/:id", h.getByID)
		q.PUT("/:id", h.update)
		q.DELETE("/:id", h.deleteQuery)
	}
}

func (h *SavedQueryHandler) create(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("not authenticated"))
		return
	}

	var req domain.CreateSavedQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	query, err := h.svc.Create(c.Request.Context(), userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusCreated, domain.SuccessResponse(query))
}

func (h *SavedQueryHandler) list(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("not authenticated"))
		return
	}

	queries, err := h.svc.ListByUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	if queries == nil {
		queries = []domain.SavedQuery{}
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(queries))
}

func (h *SavedQueryHandler) getByID(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("not authenticated"))
		return
	}

	query, err := h.svc.GetByID(c.Request.Context(), userID, c.Param("id"))
	if err != nil {
		status := http.StatusNotFound
		if err == service.ErrUnauthorized {
			status = http.StatusForbidden
		}
		c.JSON(status, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(query))
}

func (h *SavedQueryHandler) update(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("not authenticated"))
		return
	}

	var req domain.UpdateSavedQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	query, err := h.svc.Update(c.Request.Context(), userID, c.Param("id"), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(query))
}

func (h *SavedQueryHandler) deleteQuery(c *gin.Context) {
	userID, ok := GetUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse("not authenticated"))
		return
	}

	if err := h.svc.Delete(c.Request.Context(), userID, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
