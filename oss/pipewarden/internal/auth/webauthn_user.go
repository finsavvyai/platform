package auth

import (
	"strconv"

	"github.com/go-webauthn/webauthn/webauthn"
)

// PasskeyUser adapts a PipeWarden user + their stored credentials to
// the webauthn.User interface. We construct one per ceremony — it
// doesn't hold its own state, just delegates to the values passed in.
type PasskeyUser struct {
	UserID      int64
	UserName    string
	DisplayName string
	Credentials []webauthn.Credential
}

func (u *PasskeyUser) WebAuthnID() []byte {
	return []byte(strconv.FormatInt(u.UserID, 10))
}

func (u *PasskeyUser) WebAuthnName() string {
	return u.UserName
}

func (u *PasskeyUser) WebAuthnDisplayName() string {
	if u.DisplayName == "" {
		return u.UserName
	}
	return u.DisplayName
}

func (u *PasskeyUser) WebAuthnCredentials() []webauthn.Credential {
	return u.Credentials
}
