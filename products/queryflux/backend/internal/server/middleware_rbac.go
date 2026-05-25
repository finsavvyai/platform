package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/queryflux/backend/internal/domain/entities"
	"github.com/queryflux/backend/internal/services"
)

// RequirePermission is a middleware that checks if a user has a specific permission
func RequirePermission(rbacService *services.RBACService, permission entities.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Check permission
		hasPermission, err := rbacService.CheckPermission(c.Request.Context(), userID.(string), permission)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "PERMISSION_CHECK_FAILED",
				"message": "Failed to check permissions",
			})
			c.Abort()
			return
		}

		if !hasPermission {
			// Log the failed permission check
			rbacService.AuditPermissionCheck(
				c.Request.Context(),
				userID.(string),
				permission,
				"",
				"",
				false,
				c.ClientIP(),
				c.GetHeader("User-Agent"),
			)

			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You do not have permission to perform this action",
				"required": permission,
			})
			c.Abort()
			return
		}

		// Log successful permission check
		rbacService.AuditPermissionCheck(
			c.Request.Context(),
			userID.(string),
			permission,
			"",
			"",
			true,
			c.ClientIP(),
			c.GetHeader("User-Agent"),
		)

		c.Next()
	}
}

// RequireRole is a middleware that checks if a user has at least the minimum role
func RequireRole(rbacService *services.RBACService, minimumRole entities.Role) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Check role
		hasRole, err := rbacService.HasMinimumRole(c.Request.Context(), userID.(string), minimumRole)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "ROLE_CHECK_FAILED",
				"message": "Failed to check role",
			})
			c.Abort()
			return
		}

		if !hasRole {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You do not have the required role",
				"required": minimumRole,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireResourcePermission is a middleware that checks if a user has permission for a specific resource
func RequireResourcePermission(rbacService *services.RBACService, resourceType entities.ResourceType, permission entities.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Get resource ID from URL parameters
		resourceID := c.Param("id")
		if resourceID == "" {
			resourceID = c.Param("resourceId")
		}
		if resourceID == "" {
			resourceID = c.Param("userId")
		}
		if resourceID == "" {
			resourceID = c.Param("teamId")
		}
		if resourceID == "" {
			resourceID = c.Param("projectId")
		}

		if resourceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_REQUEST",
				"message": "Resource ID not found in request",
			})
			c.Abort()
			return
		}

		// Check resource permission
		hasPermission, err := rbacService.CheckResourcePermission(
			c.Request.Context(),
			userID.(string),
			resourceID,
			resourceType,
			permission,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "PERMISSION_CHECK_FAILED",
				"message": "Failed to check resource permissions",
			})
			c.Abort()
			return
		}

		if !hasPermission {
			// Log the failed permission check
			rbacService.AuditPermissionCheck(
				c.Request.Context(),
				userID.(string),
				permission,
				resourceID,
				resourceType,
				false,
				c.ClientIP(),
				c.GetHeader("User-Agent"),
			)

			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You do not have permission to access this resource",
				"resource_id": resourceID,
				"resource_type": resourceType,
				"required": permission,
			})
			c.Abort()
			return
		}

		// Log successful permission check
		rbacService.AuditPermissionCheck(
			c.Request.Context(),
			userID.(string),
			permission,
			resourceID,
			resourceType,
			true,
			c.ClientIP(),
			c.GetHeader("User-Agent"),
		)

		c.Next()
	}
}

// RequireAdmin is a middleware that requires admin role
func RequireAdmin(rbacService *services.RBACService) gin.HandlerFunc {
	return RequireRole(rbacService, entities.RoleAdmin)
}

// RequireOwner is a middleware that requires owner role
func RequireOwner(rbacService *services.RBACService) gin.HandlerFunc {
	return RequireRole(rbacService, entities.RoleOwner)
}

// RequireTeamPermission is a middleware that checks team-based permissions
func RequireTeamPermission(rbacService *services.RBACService, permission entities.Permission) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Get team ID from URL parameters
		teamID := c.Param("teamId")
		if teamID == "" {
			teamID = c.Param("id")
		}

		if teamID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "INVALID_REQUEST",
				"message": "Team ID not found in request",
			})
			c.Abort()
			return
		}

		// Check team permission
		hasPermission, err := rbacService.CheckTeamPermission(
			c.Request.Context(),
			userID.(string),
			teamID,
			permission,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "PERMISSION_CHECK_FAILED",
				"message": "Failed to check team permissions",
			})
			c.Abort()
			return
		}

		if !hasPermission {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You do not have permission to perform this action in this team",
				"team_id": teamID,
				"required": permission,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// OwnerOrAdmin is a middleware that allows either owner or admin role
func OwnerOrAdmin(rbacService *services.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Check if user is admin or owner
		isAdmin, err := rbacService.IsAdmin(c.Request.Context(), userID.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "ROLE_CHECK_FAILED",
				"message": "Failed to check role",
			})
			c.Abort()
			return
		}

		if isAdmin {
			c.Next()
			return
		}

		isOwner, err := rbacService.IsOwner(c.Request.Context(), userID.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "ROLE_CHECK_FAILED",
				"message": "Failed to check role",
			})
			c.Abort()
			return
		}

		if !isOwner {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You must be an admin or owner to perform this action",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// SelfOrAdmin is a middleware that allows users to access their own resources or admins to access any
func SelfOrAdmin(rbacService *services.RBACService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "UNAUTHORIZED",
				"message": "User not authenticated",
			})
			c.Abort()
			return
		}

		// Get target user ID from URL
		targetUserID := c.Param("userId")
		if targetUserID == "" {
			targetUserID = c.Param("id")
		}

		// Check if user is accessing their own resource
		if targetUserID == userID.(string) {
			c.Next()
			return
		}

		// Check if user is admin
		isAdmin, err := rbacService.IsAdmin(c.Request.Context(), userID.(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "ROLE_CHECK_FAILED",
				"message": "Failed to check role",
			})
			c.Abort()
			return
		}

		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "FORBIDDEN",
				"message": "You can only access your own resources",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
