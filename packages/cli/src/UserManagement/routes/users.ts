/* eslint-disable import/no-cycle */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Request, Response } from 'express';
import { getConnection, In } from 'typeorm';
import { LoggerProxy } from 'n8n-workflow';
import { genSaltSync, hashSync } from 'bcryptjs';
import { Db, GenericHelpers, ICredentialsResponse, ResponseHelper } from '../..';
import { AuthenticatedRequest, N8nApp, UserRequest } from '../Interfaces';
import { isEmailSetup, isValidEmail, sanitizeUser } from '../UserManagementHelper';
import { User } from '../../databases/entities/User';
import { SharedWorkflow } from '../../databases/entities/SharedWorkflow';
import { SharedCredentials } from '../../databases/entities/SharedCredentials';
import { getInstance } from '../email/UserManagementMailer';
import { issueJWT } from '../auth/jwt';

export function usersNamespace(this: N8nApp): void {
	this.app.post(
		`/${this.restEndpoint}/users`,
		ResponseHelper.send(async (req: UserRequest.Invites) => {
			if (!isEmailSetup()) {
				throw new ResponseHelper.ResponseError(
					'Email sending must be set up in order to invite other users',
					undefined,
					500,
				);
			}

			const invitations = req.body;

			if (!Array.isArray(invitations)) {
				throw new ResponseHelper.ResponseError('Invalid payload', undefined, 400);
			}

			// Validate payload
			invitations.forEach((invitation) => {
				if (!isValidEmail(invitation.email)) {
					throw new ResponseHelper.ResponseError(
						`Invalid email address ${invitation.email}`,
						undefined,
						400,
					);
				}
			});

			const role = await Db.collections.Role!.findOne({ scope: 'global', name: 'member' });

			if (!role) {
				throw new ResponseHelper.ResponseError(
					'Members role not found in database - inconsistent state',
					undefined,
					500,
				);
			}

			let domain = GenericHelpers.getBaseUrl();
			if (domain.endsWith('/')) {
				domain = domain.slice(0, domain.length - 1);
			}

			let createdUsers = [];
			try {
				createdUsers = await getConnection().transaction(async (transactionManager) => {
					return Promise.all(
						invitations.map(async ({ email }) => {
							const newUser = Object.assign(new User(), {
								email,
								globalRole: role,
							});
							return transactionManager.save<User>(newUser);
						}),
					);
				});
			} catch (error) {
				throw new ResponseHelper.ResponseError(
					// eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
					`Email address ${error.parameters[1]} already exists`,
					undefined,
					400,
				);
			}

			const mailer = getInstance();
			return Promise.all(
				createdUsers.map(async ({ id, email }) => {
					const inviteAcceptUrl = `${domain}/signup/inviterId=${req.user.id}&inviteeId=${id}`;
					const result = await mailer.invite({
						email,
						inviteAcceptUrl,
						domain,
					});
					if (!result.success) {
						throw new ResponseHelper.ResponseError(`Email to ${email} could not be sent`);
					}
					return { id, email };
				}),
			);
		}),
	);

	this.app.get(
		`/${this.restEndpoint}/resolve-signup-token`,
		ResponseHelper.send(async (req: Request) => {
			const inviterId = req.query.inviterId as string;
			const inviteeId = req.query.inviteeId as string;

			if (!inviterId || !inviteeId) {
				LoggerProxy.error('Invalid invite URL - did not receive user IDs', {
					inviterId,
					inviteeId,
				});
				throw new ResponseHelper.ResponseError('Invalid payload', undefined, 500);
			}

			const users = await Db.collections.User!.find({ where: { id: In([inviterId, inviteeId]) } });

			if (users.length !== 2) {
				LoggerProxy.error('Invalid invite URL - did not find users', { inviterId, inviteeId });
				throw new ResponseHelper.ResponseError('Invalid invite URL', undefined, 500);
			}

			const inviter = users.find((user) => user.id === inviterId);

			if (!inviter || !inviter.email || !inviter.firstName) {
				LoggerProxy.error('Invalid invite URL - inviter does not have email set', {
					inviterId,
					inviteeId,
				});
				throw new ResponseHelper.ResponseError('Invalid request', undefined, 500);
			}
			const { firstName, lastName } = inviter;

			return { inviter: { firstName, lastName } };
		}),
	);

	this.app.post(
		`/${this.restEndpoint}/user`,
		ResponseHelper.send(async (req: AuthenticatedRequest, res: Response) => {
			if (req.user) {
				throw new ResponseHelper.ResponseError(
					'Please logout before accepting another invite.',
					undefined,
					500,
				);
			}

			const { inviterId, inviteeId, firstName, lastName, password } = req.body as {
				inviterId: string;
				inviteeId: string;
				firstName: string;
				lastName: string;
				password: string;
			};

			if (!inviterId || !inviteeId || !firstName || !lastName || !password) {
				throw new ResponseHelper.ResponseError('Invalid payload', undefined, 500);
			}

			const users = await Db.collections.User!.find({
				where: { id: In([inviterId, inviteeId]) },
			});

			if (users.length !== 2) {
				throw new ResponseHelper.ResponseError('Invalid invite URL', undefined, 500);
			}

			const invitee = users.find((user) => user.id === inviteeId);

			if (!invitee || invitee.password) {
				throw new ResponseHelper.ResponseError(
					'This invite has been accepted already',
					undefined,
					500,
				);
			}

			invitee.firstName = firstName;
			invitee.lastName = lastName;
			invitee.password = hashSync(password, genSaltSync(10));

			const updatedUser = await Db.collections.User!.save(invitee);

			const userData = await issueJWT(updatedUser);
			res.cookie('n8n-auth', userData.token, { maxAge: userData.expiresIn, httpOnly: true });
			return sanitizeUser(updatedUser);
		}),
	);

	this.app.get(
		`/${this.restEndpoint}/users`,
		ResponseHelper.send(async () => {
			const users = await Db.collections.User!.find();

			return users.map((user) => sanitizeUser(user));
		}),
	);

	this.app.delete(
		`/${this.restEndpoint}/users/:id`,
		ResponseHelper.send(async (req: UserRequest.Deletion) => {
			if (req.user.id === req.params.id) {
				throw new ResponseHelper.ResponseError('You cannot delete your own user', undefined, 400);
			}

			const { transferId } = req.query;

			const searchIds = [req.params.id];
			if (transferId) {
				if (transferId === req.params.id) {
					throw new ResponseHelper.ResponseError(
						'Removed user and transferred user cannot be the same',
						undefined,
						400,
					);
				}
				searchIds.push(transferId);
			}

			const users = await Db.collections.User!.find({ where: { id: In(searchIds) } });
			if ((transferId && users.length !== 2) || users.length === 0) {
				throw new ResponseHelper.ResponseError('Could not find user', undefined, 404);
			}

			const deleteUser = users.find((user) => user.id === req.params.id) as User;

			if (transferId) {
				const transferUser = users.find((user) => user.id === transferId) as User;
				await getConnection().transaction(async (transactionManager) => {
					await transactionManager.update(
						SharedWorkflow,
						{ user: deleteUser },
						{ user: transferUser },
					);
					await transactionManager.update(
						SharedCredentials,
						{ user: deleteUser },
						{ user: transferUser },
					);
					await transactionManager.delete(User, { id: deleteUser.id });
				});
			} else {
				const [ownedWorkflows, ownedCredentials] = await Promise.all([
					Db.collections.SharedWorkflow!.find({
						relations: ['workflow'],
						where: { user: deleteUser },
					}),
					Db.collections.SharedCredentials!.find({
						relations: ['credentials'],
						where: { user: deleteUser },
					}),
				]);
				await getConnection().transaction(async (transactionManager) => {
					await transactionManager.remove(ownedWorkflows.map(({ workflow }) => workflow));
					await transactionManager.remove(ownedCredentials.map(({ credentials }) => credentials));
					await transactionManager.delete(User, { id: deleteUser.id });
				});
			}
			return { success: true };
		}),
	);

	this.app.post(
		`/${this.restEndpoint}/users/:id/reinvite`,
		ResponseHelper.send(async (req: UserRequest.Reinvite) => {
			if (!isEmailSetup()) {
				throw new ResponseHelper.ResponseError(
					'Email sending must be set up in order to invite other users',
					undefined,
					500,
				);
			}

			const user = await Db.collections.User!.findOne({ id: req.params.id });

			if (!user) {
				throw new ResponseHelper.ResponseError('User not found', undefined, 404);
			}

			if (user.password) {
				throw new ResponseHelper.ResponseError(
					'User has already accepted the invite',
					undefined,
					400,
				);
			}

			let domain = GenericHelpers.getBaseUrl();
			if (domain.endsWith('/')) {
				domain = domain.slice(0, domain.length - 1);
			}

			const inviteAcceptUrl = `${domain}/signup/inviterId=${req.user.id}&inviteeId=${user.id}`;

			const mailer = getInstance();
			const result = await mailer.invite({
				email: user.email,
				inviteAcceptUrl,
				domain,
			});

			if (!result.success) {
				throw new ResponseHelper.ResponseError(
					`Failed to send email to ${user.email}`,
					undefined,
					500,
				);
			}
			return { success: true };
		}),
	);
}
