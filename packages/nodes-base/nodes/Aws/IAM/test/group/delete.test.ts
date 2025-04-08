import nock from 'nock';

import {
	getWorkflowFilenames,
	initBinaryDataService,
	testWorkflows,
} from '../../../../../test/nodes/Helpers';
import { CURRENT_VERSION } from '../../helpers/constants';

describe('AWS IAM - Delete Group', () => {
	const workflows = getWorkflowFilenames(__dirname).filter((filename) =>
		filename.includes('delete.workflow.json'),
	);

	beforeAll(async () => {
		await initBinaryDataService();
	});

	beforeEach(() => {
		if (!nock.isActive()) {
			nock.activate();
		}

		const baseUrl = 'https://iam.amazonaws.com/';
		nock.cleanAll();
		nock(baseUrl)
			.persist()
			.defaultReplyHeaders({ 'Content-Type': 'application/x-amz-json-1.1' })
			.post('/', {
				Action: 'GetGroup',
				Version: CURRENT_VERSION,
				GroupName: 'GroupForTest1',
			})
			.reply(200, {
				GetGroupResponse: {
					GetGroupResult: {
						Users: [{ UserName: 'User1' }],
					},
				},
			});
		nock(baseUrl)
			.persist()
			.defaultReplyHeaders({ 'Content-Type': 'application/x-amz-json-1.1' })
			.post('/', {
				Action: 'RemoveUserFromGroup',
				Version: CURRENT_VERSION,
				GroupName: 'GroupForTest1',
				UserName: 'User1',
			})
			.reply(200, {});
		nock(baseUrl)
			.persist()
			.defaultReplyHeaders({ 'Content-Type': 'application/x-amz-json-1.1' })
			.post('/', {
				Action: 'DeleteGroup',
				Version: CURRENT_VERSION,
				GroupName: 'GroupForTest1',
			})
			.reply(200, {
				DeleteGroupResponse: {
					ResponseMetadata: {
						RequestId: 'b9cc2642-db2c-4935-aaaf-eacf10e4f00a',
					},
				},
			});
	});

	afterEach(() => {
		nock.cleanAll();
	});

	testWorkflows(workflows);
});
