package adapter

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain"
)

func (s *HTTPServer) login(c *gin.Context) {
	var req domain.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	response, err := s.authService.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(response))
}

func (s *HTTPServer) refreshToken(c *gin.Context) {
	var req domain.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, domain.ErrorResponse(err.Error()))
		return
	}

	response, err := s.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, domain.ErrorResponse(err.Error()))
		return
	}

	c.JSON(http.StatusOK, domain.SuccessResponse(response))
}
