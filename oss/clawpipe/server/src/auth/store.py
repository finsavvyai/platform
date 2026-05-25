"""In-memory auth store used by the FastAPI auth routes."""

from __future__ import annotations

from typing import Any

_users_by_username: dict[str, dict[str, Any]] = {}


def clear_users() -> None:
    """Reset the in-memory user store."""
    _users_by_username.clear()


def get_user_by_username(username: str) -> dict[str, Any] | None:
    """Return a user by username."""
    return _users_by_username.get(username)


def get_user_by_email(email: str) -> dict[str, Any] | None:
    """Return a user by email."""
    return next((user for user in _users_by_username.values() if user["email"] == email), None)


def get_user_by_login(login: str) -> dict[str, Any] | None:
    """Look up a user by username first, then by email."""
    return get_user_by_username(login) or get_user_by_email(login)


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Return a user by id."""
    return next((user for user in _users_by_username.values() if user["id"] == user_id), None)


def save_user(user: dict[str, Any]) -> None:
    """Insert or replace a user record."""
    _users_by_username[user["username"]] = user
