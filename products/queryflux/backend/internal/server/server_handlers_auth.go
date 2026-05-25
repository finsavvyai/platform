package server

import "github.com/gin-gonic/gin"

// Authentication handlers delegating to AuthHandlers

func (s *Server) register(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.Register(c)
}

func (s *Server) login(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.Login(c)
}

func (s *Server) logout(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.Logout(c)
}

func (s *Server) refreshToken(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.RefreshToken(c)
}

func (s *Server) getUserProfile(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.Me(c)
}

func (s *Server) updateUserProfile(c *gin.Context) {
	authHandlers := NewAuthHandlers(s.container.GetAuthService(), s.container.GetUserService())
	authHandlers.UpdateProfile(c)
}
