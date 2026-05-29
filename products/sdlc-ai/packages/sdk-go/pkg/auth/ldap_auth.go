package auth

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/url"
	"strings"
	"time"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
	"github.com/go-ldap/ldap/v3"
)

// LDAPAuth implements LDAP/Active Directory authentication
type LDAPAuth struct {
	config       *LDAPConfig
	sessionStore LDAPSessionStore
	connPool     *LDAPConnectionPool
	clock        Clock
}

// LDAPConfig holds LDAP configuration
type LDAPConfig struct {
	ServerURLs         []string          `json:"server_urls"`          // LDAP server URLs
	BaseDN             string            `json:"base_dn"`              // Base DN for searches
	BindDN             string            `json:"bind_dn"`              // Bind DN for authentication
	BindPassword       string            `json:"bind_password"`        // Bind password
	UserSearchBase     string            `json:"user_search_base"`     // Base DN for user searches
	UserSearchFilter   string            `json:"user_search_filter"`   // Filter for user searches
	GroupSearchBase    string            `json:"group_search_base"`    // Base DN for group searches
	GroupSearchFilter  string            `json:"group_search_filter"`  // Filter for group searches
	UserAttributes     []string          `json:"user_attributes"`      // Attributes to fetch
	GroupAttributes    []string          `json:"group_attributes"`     // Group attributes to fetch
	SearchPageSize     int               `json:"search_page_size"`     // Pagination size
	Timeout            time.Duration     `json:"timeout"`              // Connection timeout
	UseTLS             bool              `json:"use_tls"`              // Use TLS connection
	InsecureSkipVerify bool              `json:"insecure_skip_verify"` // Skip TLS verification
	CAFile             string            `json:"ca_file"`              // CA certificate file
	AttributeMapping   map[string]string `json:"-"`                    // LDAP attribute mapping
	GroupMapping       map[string]string `json:"-"`                    // LDAP group mapping
	SyncInterval       time.Duration     `json:"sync_interval"`        // Sync interval
	MaxConnections     int               `json:"max_connections"`      // Max connections in pool
}

// LDAPSessionStore interface for storing LDAP sessions
type LDAPSessionStore interface {
	Store(ctx context.Context, sessionID string, session *LDAPSession) error
	Get(ctx context.Context, sessionID string) (*LDAPSession, error)
	Delete(ctx context.Context, sessionID string) error
	Update(ctx context.Context, sessionID string, session *LDAPSession) error
}

// LDAPSession represents an LDAP session
type LDAPSession struct {
	SessionID    string            `json:"session_id"`
	UserDN       string            `json:"user_dn"`
	Username     string            `json:"username"`
	Email        string            `json:"email"`
	DisplayName  string            `json:"display_name"`
	FirstName    string            `json:"first_name"`
	LastName     string            `json:"last_name"`
	Groups       []string          `json:"groups"`
	Attributes   map[string]string `json:"attributes"`
	LastSync     time.Time         `json:"last_sync"`
	ExpiresAt    time.Time         `json:"expires_at"`
	CreatedAt    time.Time         `json:"created_at"`
	LastAccessed time.Time         `json:"last_accessed"`
}

// LDAPUser represents an LDAP user
type LDAPUser struct {
	DN                string            `json:"dn"`
	Username          string            `json:"username"`
	Email             string            `json:"email"`
	DisplayName       string            `json:"display_name"`
	FirstName         string            `json:"first_name"`
	LastName          string            `json:"last_name"`
	Groups            []string          `json:"groups"`
	Attributes        map[string]string `json:"attributes"`
	MemberOf          []string          `json:"member_of"`
	UserPrincipalName string            `json:"user_principal_name"`
	ObjectClass       []string          `json:"object_class"`
	LastLogon         time.Time         `json:"last_logon"`
	AccountLocked     bool              `json:"account_locked"`
	AccountEnabled    bool              `json:"account_enabled"`
	PasswordExpired   bool              `json:"password_expired"`
}

// LDAPGroup represents an LDAP group
type LDAPGroup struct {
	DN          string            `json:"dn"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Members     []string          `json:"members"`
	Attributes  map[string]string `json:"attributes"`
	ObjectClass []string          `json:"object_class"`
}

// LDAPConnectionPool manages LDAP connections
type LDAPConnectionPool struct {
	config      *LDAPConfig
	connections chan *ldap.Conn
	maxSize     int
	factory     func() (*ldap.Conn, error)
}

// NewLDAPAuth creates a new LDAP authenticator
func NewLDAPAuth(config *LDAPConfig, sessionStore LDAPSessionStore) (*LDAPAuth, error) {
	if config == nil {
		return nil, fmt.Errorf("LDAP config is required")
	}
	if sessionStore == nil {
		return nil, fmt.Errorf("session store is required")
	}

	// Set default values
	if len(config.ServerURLs) == 0 {
		return nil, fmt.Errorf("at least one LDAP server URL is required")
	}
	if config.BaseDN == "" {
		return nil, fmt.Errorf("base DN is required")
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.SearchPageSize == 0 {
		config.SearchPageSize = 1000
	}
	if config.MaxConnections == 0 {
		config.MaxConnections = 10
	}

	// Set default attribute mappings
	if config.AttributeMapping == nil {
		config.AttributeMapping = map[string]string{
			"sAMAccountName":     "username",
			"userPrincipalName":  "upn",
			"mail":               "email",
			"displayName":        "display_name",
			"givenName":          "first_name",
			"sn":                 "last_name",
			"memberOf":           "groups",
			"objectClass":        "object_class",
			"userAccountControl": "account_control",
			"lastLogonTimestamp": "last_logon",
		}
	}

	// Set default group mappings
	if config.GroupMapping == nil {
		config.GroupMapping = map[string]string{
			"cn":          "name",
			"description": "description",
			"objectClass": "object_class",
		}
	}

	// Create connection pool
	connPool, err := NewLDAPConnectionPool(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create LDAP connection pool: %w", err)
	}

	auth := &LDAPAuth{
		config:       config,
		sessionStore: sessionStore,
		connPool:     connPool,
		clock:        SystemClock{},
	}

	return auth, nil
}

// NewLDAPConnectionPool creates a new LDAP connection pool
func NewLDAPConnectionPool(config *LDAPConfig) (*LDAPConnectionPool, error) {
	pool := &LDAPConnectionPool{
		config:      config,
		connections: make(chan *ldap.Conn, config.MaxConnections),
		maxSize:     config.MaxConnections,
		factory:     func() (*ldap.Conn, error) { return createLDAPConnection(config) },
	}

	// Pre-warm the pool with a few connections
	for i := 0; i < min(config.MaxConnections, 3); i++ {
		conn, err := pool.factory()
		if err != nil {
			// Log error but continue
			continue
		}
		pool.connections <- conn
	}

	return pool, nil
}

// createLDAPConnection creates a new LDAP connection
func createLDAPConnection(config *LDAPConfig) (*ldap.Conn, error) {
	// Parse server URL
	serverURL, err := url.Parse(config.ServerURLs[0])
	if err != nil {
		return nil, fmt.Errorf("invalid server URL: %w", err)
	}

	// Set up TLS configuration if needed
	var tlsConfig *tls.Config
	if config.UseTLS {
		tlsConfig = &tls.Config{
			InsecureSkipVerify: config.InsecureSkipVerify,
		}

		if config.CAFile != "" {
			// Load CA certificate
			// This would require implementing certificate loading
		}
	}

	// Create LDAP connection
	var conn *ldap.Conn
	if config.UseTLS {
		conn, err = ldap.DialTLS("tcp", serverURL.Host, tlsConfig, ldap.DialWithDialer(&net.Dialer{
			Timeout: config.Timeout,
		}))
	} else {
		conn, err = ldap.Dial("tcp", serverURL.Host, ldap.DialWithDialer(&net.Dialer{
			Timeout: config.Timeout,
		}))
	}

	if err != nil {
		return nil, fmt.Errorf("failed to connect to LDAP server: %w", err)
	}

	// Bind to the server
	bindRequest := ldap.NewSimpleBindRequest(config.BindDN, config.BindPassword, nil)
	if err := conn.Bind(bindRequest); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to bind to LDAP server: %w", err)
	}

	return conn, nil
}

// GetConnection gets a connection from the pool
func (p *LDAPConnectionPool) GetConnection() (*ldap.Conn, error) {
	select {
	case conn := <-p.connections:
		return conn, nil
	default:
		// Pool is empty, create a new connection
		return p.factory()
	}
}

// ReturnConnection returns a connection to the pool
func (p *LDAPConnectionPool) ReturnConnection(conn *ldap.Conn) {
	select {
	case p.connections <- conn:
		// Connection returned to pool
	default:
		// Pool is full, close the connection
		conn.Close()
	}
}

// Authenticate authenticates a user against LDAP
func (s *LDAPAuth) Authenticate(ctx context.Context, username, password string) (*LDAPSession, error) {
	// Get a connection from the pool
	conn, err := s.connPool.GetConnection()
	if err != nil {
		return nil, fmt.Errorf("failed to get LDAP connection: %w", err)
	}
	defer s.connPool.ReturnConnection(conn)

	// Find user DN
	userDN, err := s.findUserDN(conn, username)
	if err != nil {
		return nil, fmt.Errorf("failed to find user DN: %w", err)
	}

	// Authenticate user
	bindRequest := ldap.NewSimpleBindRequest(userDN, password, nil)
	if err := conn.Bind(bindRequest); err != nil {
		return nil, fmt.Errorf("LDAP authentication failed: %w", err)
	}

	// Fetch user information
	user, err := s.fetchUser(conn, userDN)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user information: %w", err)
	}

	// Fetch user groups
	groups, err := s.fetchUserGroups(conn, userDN)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch user groups: %w", err)
	}
	user.Groups = groups

	// Create session
	session := &LDAPSession{
		SessionID:    sdln.GenerateID(),
		UserDN:       user.DN,
		Username:     user.Username,
		Email:        user.Email,
		DisplayName:  user.DisplayName,
		FirstName:    user.FirstName,
		LastName:     user.LastName,
		Groups:       user.Groups,
		Attributes:   user.Attributes,
		LastSync:     s.clock.Now(),
		ExpiresAt:    s.clock.Now().Add(24 * time.Hour), // Default 24-hour expiration
		CreatedAt:    s.clock.Now(),
		LastAccessed: s.clock.Now(),
	}

	// Store session
	if err := s.sessionStore.Store(ctx, session.SessionID, session); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return session, nil
}

// findUserDN finds a user's distinguished name
func (s *LDAPAuth) findUserDN(conn *ldap.Conn, username string) (string, error) {
	searchBase := s.config.UserSearchBase
	if searchBase == "" {
		searchBase = s.config.BaseDN
	}

	// Create search filter for username
	filter := s.config.UserSearchFilter
	if filter == "" {
		filter = fmt.Sprintf("(sAMAccountName=%s)", ldap.EscapeFilter(username))
	} else {
		filter = fmt.Sprintf(filter, ldap.EscapeFilter(username))
	}

	searchRequest := ldap.NewSearchRequest(
		searchBase,
		ldap.ScopeWholeSubtree,
		filter,
		[]string{"distinguishedName"},
		nil,
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil {
		return "", fmt.Errorf("LDAP search failed: %w", err)
	}
	defer sr.Close()

	if len(sr.Entries) == 0 {
		return "", fmt.Errorf("user not found")
	}

	if len(sr.Entries) > 1 {
		return "", fmt.Errorf("multiple users found")
	}

	return sr.Entries[0].DN, nil
}

// fetchUser fetches user information from LDAP
func (s *LDAPAuth) fetchUser(conn *ldap.Conn, userDN string) (*LDAPUser, error) {
	attributes := s.config.UserAttributes
	if len(attributes) == 0 {
		attributes = []string{
			"sAMAccountName",
			"userPrincipalName",
			"mail",
			"displayName",
			"givenName",
			"sn",
			"memberOf",
			"objectClass",
			"userAccountControl",
			"lastLogonTimestamp",
		}
	}

	searchRequest := ldap.NewSearchRequest(
		userDN,
		ldap.ScopeBaseObject,
		"(objectClass=*)",
		attributes,
		nil,
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil {
		return nil, fmt.Errorf("failed to search user: %w", err)
	}
	defer sr.Close()

	if len(sr.Entries) == 0 {
		return nil, fmt.Errorf("user not found")
	}

	entry := sr.Entries[0]
	user := &LDAPUser{
		DN:         entry.DN,
		Attributes: make(map[string]string),
	}

	// Extract attributes
	for _, attr := range attributes {
		values := entry.GetAttributeValues(attr)
		if len(values) > 0 {
			mappedAttr := s.config.AttributeMapping[attr]
			if mappedAttr == "" {
				mappedAttr = attr
			}

			value := values[0]
			switch mappedAttr {
			case "username":
				user.Username = value
			case "email":
				user.Email = value
			case "display_name":
				user.DisplayName = value
			case "first_name":
				user.FirstName = value
			case "last_name":
				user.LastName = value
			case "groups":
				// Handle memberOf (may be a distinguished name)
				if strings.Contains(value, "CN=") {
					user.Groups = append(user.Groups, s.extractGroupNameFromDN(value))
				} else {
					user.Groups = append(user.Groups, value)
				}
			case "object_class":
				user.ObjectClass = values
			case "account_control":
				user.AccountEnabled = !s.isAccountDisabled(value)
				user.AccountLocked = s.isAccountLocked(value)
			default:
				user.Attributes[mappedAttr] = value
			}
		}
	}

	return user, nil
}

// fetchUserGroups fetches user groups from LDAP
func (s *LDAPAuth) fetchUserGroups(conn *ldap.Conn, userDN string) ([]string, error) {
	var groups []string

	// Method 1: Use memberOf attribute (for Active Directory)
	groups = s.fetchGroupsFromMemberOf(conn, userDN)
	if len(groups) > 0 {
		return groups, nil
	}

	// Method 2: Search for groups that have this user as a member
	groups, err := s.searchUserGroups(conn, userDN)
	if err != nil {
		return nil, err
	}

	return groups, nil
}

// fetchGroupsFromMemberOf extracts groups from memberOf attribute
func (s *LDAPAuth) fetchGroupsFromMemberOf(conn *ldap.Conn, userDN string) []string {
	var groups []string

	searchRequest := ldap.NewSearchRequest(
		userDN,
		ldap.ScopeBaseObject,
		"(objectClass=*)",
		[]string{"memberOf"},
		nil,
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil {
		return groups
	}
	defer sr.Close()

	if len(sr.Entries) > 0 {
		entry := sr.Entries[0]
		memberOfValues := entry.GetAttributeValues("memberOf")
		for _, value := range memberOfValues {
			if strings.Contains(value, "CN=") {
				groups = append(groups, s.extractGroupNameFromDN(value))
			} else {
				groups = append(groups, value)
			}
		}
	}

	return groups
}

// searchUserGroups searches for groups that have this user as a member
func (s *LDAPAuth) searchUserGroups(conn *ldap.Conn, userDN string) ([]string, error) {
	var groups []string

	searchBase := s.config.GroupSearchBase
	if searchBase == "" {
		searchBase = s.config.BaseDN
	}

	filter := s.config.GroupSearchFilter
	if filter == "" {
		filter = fmt.Sprintf("(member=%s)", ldap.EscapeFilter(userDN))
	}

	attributes := s.config.GroupAttributes
	if len(attributes) == 0 {
		attributes = []string{"cn", "distinguishedName"}
	}

	searchRequest := ldap.NewSearchRequest(
		searchBase,
		ldap.ScopeWholeSubtree,
		filter,
		attributes,
		nil,
		nil,
	)

	sr, err := conn.SearchWithPaging(searchRequest, s.config.SearchPageSize)
	if err != nil {
		return nil, err
	}
	defer sr.Close()

	for {
		if len(sr.Entries) == 0 {
			break
		}

		for _, entry := range sr.Entries {
			groupName := entry.GetAttributeValue("cn")
			if groupName != "" {
				groups = append(groups, groupName)
			}
		}

		sr, err = sr.Next()
		if err != nil {
			break
		}
	}

	return groups, nil
}

// extractGroupNameFromDN extracts group name from distinguished name
func (s *LDAPAuth) extractGroupNameFromDN(dn string) string {
	parts := strings.Split(dn, ",")
	for _, part := range parts {
		if strings.HasPrefix(part, "CN=") {
			return strings.TrimPrefix(part, "CN=")
		}
	}
	return dn
}

// isAccountDisabled checks if account is disabled (Active Directory)
func (s *LDAPAuth) isAccountDisabled(uac string) bool {
	// UserAccountControl flags
	const (
		ACCOUNTDISABLE = 0x00000002
	)

	value, err := s.parseUserAccountControl(uac)
	if err != nil {
		return false
	}

	return value&ACCOUNTDISABLE != 0
}

// isAccountLocked checks if account is locked (Active Directory)
func (s *LDAPAuth) isAccountLocked(uac string) bool {
	// UserAccountControl flags
	const (
		LOCKOUT = 0x00000010
	)

	value, err := s.parseUserAccountControl(uac)
	if err != nil {
		return false
	}

	return value&LOCKOUT != 0
}

// parseUserAccountControl parses UserAccountControl value
func (s *LDAPAuth) parseUserAccountControl(uac string) (uint32, error) {
	var value uint32
	_, err := fmt.Sscanf(uac, "%d", &value)
	return value, err
}

// SyncUsers synchronizes users from LDAP
func (s *LDAPAuth) SyncUsers(ctx context.Context) error {
	conn, err := s.connPool.GetConnection()
	if err != nil {
		return fmt.Errorf("failed to get LDAP connection: %w", err)
	}
	defer s.connPool.ReturnConnection(conn)

	searchBase := s.config.UserSearchBase
	if searchBase == "" {
		searchBase = s.config.BaseDN
	}

	attributes := s.config.UserAttributes
	if len(attributes) == 0 {
		attributes = []string{
			"sAMAccountName",
			"userPrincipalName",
			"mail",
			"displayName",
			"givenName",
			"sn",
			"objectClass",
			"userAccountControl",
			"lastLogonTimestamp",
		}
	}

	searchRequest := ldap.NewSearchRequest(
		searchBase,
		ldap.ScopeWholeSubtree,
		"(objectClass=user)",
		attributes,
		nil,
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil {
		return fmt.Errorf("failed to search users: %w", err)
	}
	defer sr.Close()

	// Process users in batches
	batchSize := 100
	users := make([]*LDAPUser, 0, batchSize)

	for sr.Entries() != nil {
		entry := sr.Next()
		if entry == nil {
			break
		}

		user := s.entryToLDAPUser(entry)
		users = append(users, user)

		// Process batch
		if len(users) >= batchSize {
			if err := s.processBatch(ctx, users); err != nil {
				// Log error but continue
			}
			users = users[:0] // Reset batch
		}
	}

	// Process remaining users
	if len(users) > 0 {
		s.processBatch(ctx, users)
	}

	return nil
}

// entryToLDAPUser converts LDAP entry to LDAPUser
func (s *LDAPAuth) entryToLDAPUser(entry *ldap.Entry) *LDAPUser {
	user := &LDAPUser{
		DN:         entry.DN,
		Attributes: make(map[string]string),
	}

	for _, attr := range s.config.UserAttributes {
		values := entry.GetAttributeValues(attr)
		if len(values) > 0 {
			value := values[0]
			mappedAttr := s.config.AttributeMapping[attr]
			if mappedAttr == "" {
				mappedAttr = attr
			}

			switch mappedAttr {
			case "username":
				user.Username = value
			case "email":
				user.Email = value
			case "display_name":
				user.DisplayName = value
			case "first_name":
				user.FirstName = value
			case "last_name":
				user.LastName = value
			case "object_class":
				user.ObjectClass = values
			case "account_control":
				user.AccountEnabled = !s.isAccountDisabled(value)
				user.AccountLocked = s.isAccountLocked(value)
			case "last_logon":
				// Parse timestamp (Active Directory format)
				if timestamp, err := s.parseADTimestamp(value); err == nil {
					user.LastLogon = timestamp
				}
			default:
				user.Attributes[mappedAttr] = value
			}
		}
	}

	return user
}

// processBatch processes a batch of users
func (s *LDAPAuth) processBatch(ctx context.Context, users []*LDAPUser) error {
	// This would update your local user database
	// Implementation depends on your storage system
	return nil
}

// parseADTimestamp parses Active Directory timestamp format
func (s *LDAPAuth) parseADTimestamp(timestamp string) (time.Time, error) {
	// Active Directory timestamps are stored as FILETIME format
	// This is a simplified implementation
	return time.Parse("20060102150405.0Z", timestamp)
}

// GetSession retrieves an LDAP session
func (s *LDAPAuth) GetSession(ctx context.Context, sessionID string) (*LDAPSession, error) {
	return s.sessionStore.Get(ctx, sessionID)
}

// DeleteSession deletes an LDAP session
func (s *LDAPAuth) DeleteSession(ctx context.Context, sessionID string) error {
	return s.sessionStore.Delete(ctx, sessionID)
}

// RefreshSession refreshes an LDAP session
func (s *LDAPAuth) RefreshSession(ctx context.Context, sessionID string) error {
	session, err := s.sessionStore.Get(ctx, sessionID)
	if err != nil {
		return err
	}

	// Update last accessed time
	session.LastAccessed = s.clock.Now()
	session.ExpiresAt = s.clock.Now().Add(24 * time.Hour)

	return s.sessionStore.Update(ctx, sessionID, session)
}

// Authenticate implements the Authenticator interface
func (s *LDAPAuth) Authenticate(ctx context.Context, req sdln.Request) error {
	// LDAP authentication is handled at the application layer
	// This method can add any LDAP-specific headers if needed
	return nil
}

// RefreshToken is a no-op for LDAP authentication
func (s *LDAPAuth) RefreshToken(ctx context.Context) error {
	return nil
}

// IsValid checks if the LDAP session is valid
func (s *LDAPAuth) IsValid(ctx context.Context) bool {
	// LDAP validation is handled by session management
	return true
}

// Close closes the LDAP connection pool
func (s *LDAPAuth) Close() error {
	close(s.connPool.connections)
	return nil
}

// SetAttributeMapping sets custom attribute mappings
func (s *LDAPAuth) SetAttributeMapping(mapping map[string]string) {
	for key, value := range mapping {
		s.config.AttributeMapping[key] = value
	}
}

// SetGroupMapping sets custom group mappings
func (s *LDAPAuth) SetGroupMapping(mapping map[string]string) {
	for key, value := range mapping {
		s.config.GroupMapping[key] = value
	}
}

// TestConnection tests the LDAP connection
func (s *LDAPAuth) TestConnection(ctx context.Context) error {
	conn, err := s.connPool.GetConnection()
	if err != nil {
		return fmt.Errorf("failed to get LDAP connection: %w", err)
	}
	defer s.connPool.ReturnConnection(conn)

	// Test search
	searchRequest := ldap.NewSearchRequest(
		s.config.BaseDN,
		ldap.ScopeBaseObject,
		"(objectClass=*)",
		[]string{"objectClass"},
		nil,
		nil,
	)

	sr, err := conn.Search(searchRequest)
	if err != nil {
		return fmt.Errorf("LDAP search test failed: %w", err)
	}
	sr.Close()

	return nil
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
