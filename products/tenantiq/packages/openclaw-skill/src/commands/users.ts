/**
 * User Management Commands — barrel re-export
 */

import type { Command } from '../types';
import { searchUserCommand } from './user-search';
import { userDetailsCommand } from './user-details';
import { guestUsersCommand, removeGuestCommand } from './user-guests';
import { resetPasswordCommand } from './user-password';

export {
	searchUserCommand,
	userDetailsCommand,
	guestUsersCommand,
	removeGuestCommand,
	resetPasswordCommand
};

export const userCommands: Command[] = [
	searchUserCommand,
	userDetailsCommand,
	guestUsersCommand,
	removeGuestCommand,
	resetPasswordCommand
];
