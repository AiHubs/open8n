import { IPersonalizationSurveyAnswers, IRestApiContext, IUserResponse } from '@/Interface';
import { IDataObject } from 'n8n-workflow';
import { makeRestApiRequest } from './helpers';

export async function loginCurrentUser(context: IRestApiContext): Promise<IUserResponse | null> {
	return await makeRestApiRequest(context, 'GET', '/login');
}

export async function getCurrentUser(context: IRestApiContext): Promise<IUserResponse | null> {
	return await makeRestApiRequest(context, 'GET', '/me');
}

export async function login(context: IRestApiContext, params: {email: string, password: string}): Promise<IUserResponse> {
	return await makeRestApiRequest(context, 'POST', '/login', params);
}

export async function logout(context: IRestApiContext): Promise<void> {
	await makeRestApiRequest(context, 'POST', '/logout');
}

export async function setupOwner(context: IRestApiContext, params: { firstName: string; lastName: string; email: string; password: string;}): Promise<IUserResponse> {
	return await makeRestApiRequest(context, 'POST', '/owner/setup', params as unknown as IDataObject);
}

export async function validateSignupToken(context: IRestApiContext, params: {inviterId: string; inviteeId: string}): Promise<{inviter: {firstName: string, lastName: string}}> {
	return await makeRestApiRequest(context, 'GET', '/resolve-signup-token', params);
}

export async function signup(context: IRestApiContext, params:  {inviterId: string; inviteeId: string; firstName: string; lastName: string; password: string}): Promise<IUserResponse> {
	return await makeRestApiRequest(context, 'POST', '/user', params as unknown as IDataObject);
}

export async function sendForgotPasswordEmail(context: IRestApiContext, params: {email: string}): Promise<void> {
	await makeRestApiRequest(context, 'POST', '/forgot-password', params);
}

export async function validatePasswordToken(context: IRestApiContext, params: {token: string, userId: string}): Promise<void> {
	await makeRestApiRequest(context, 'GET', '/resolve-password-token', params);
}

export async function changePassword(context: IRestApiContext, params: {token: string, password: string, userId: string}): Promise<void> {
	await makeRestApiRequest(context, 'POST', '/change-password', params);
}

export async function updateCurrentUser(context: IRestApiContext, params: {id: string, firstName: string, lastName: string, email: string}): Promise<IUserResponse> {
	return await makeRestApiRequest(context, 'PATCH', `/me`, params as unknown as IDataObject);
}

export async function updateCurrentUserPassword(context: IRestApiContext, params: {password: string}): Promise<void> {
	return await makeRestApiRequest(context, 'PATCH', `/me/password`, params);
}

export async function deleteUser(context: IRestApiContext, {id, transferId}: {id: string, transferId?: string}): Promise<void> {
	await makeRestApiRequest(context, 'DELETE', `/users/${id}`, transferId ? { transferId } : {});
}

export async function getUsers(context: IRestApiContext): Promise<IUserResponse[]> {
	return await makeRestApiRequest(context, 'GET', '/users');
}

export async function inviteUsers(context: IRestApiContext, params: Array<{email: string}>): Promise<Array<Partial<IUserResponse>>> {
	return await makeRestApiRequest(context, 'POST', '/users', params as unknown as IDataObject);
}

export async function reinvite(context: IRestApiContext, {id}: {id: string}): Promise<void> {
	await makeRestApiRequest(context, 'POST', `/users/${id}/reinvite`);
}

export async function submitPersonalizationSurvey(context: IRestApiContext, params: IPersonalizationSurveyAnswers): Promise<void> {
	await makeRestApiRequest(context, 'POST', '/me/survey', params as unknown as IDataObject);
}
