import nock from 'nock';

import * as update from '../../../../v2/actions/record/update.operation';

import * as transport from '../../../../v2/transport';
import { createMockExecuteFunction } from '../helpers';

jest.mock('../../../../v2/transport', () => {
	const originalModule = jest.requireActual('../../../../v2/transport');
	return {
		...originalModule,
		apiRequest: jest.fn(async function () {
			return {};
		}),
		apiRequestAllItems: jest.fn(async function (method: string) {
			if (method === 'GET') {
				return {
					records: [
						{
							id: 'recYYY',
							fields: {
								foo: 'foo 2',
								bar: 'bar 2',
							},
						},
						{
							id: 'recXXX',
							fields: {
								foo: 'foo 1',
								bar: 'bar 1',
							},
						},
					],
				};
			}
		}),
	};
});

describe('Test AirtableV2, update operation', () => {
	beforeAll(() => {
		nock.disableNetConnect();
	});

	afterAll(() => {
		nock.restore();
		jest.unmock('../../../../v2/transport');
	});

	it('should update a record by id, autoMapInputData', async () => {
		const nodeParameters = {
			operation: 'update',
			dataMode: 'autoMapInputData',
			columnToMatchOn: 'id',
			options: {},
		};

		const items = [
			{
				json: {
					id: 'recXXX',
					foo: 'foo 1',
					bar: 'bar 1',
				},
			},
		];

		await update.execute.call(
			createMockExecuteFunction(nodeParameters),
			items,
			'appYoLbase',
			'tblltable',
		);

		expect(transport.apiRequest).toHaveBeenCalledWith('PATCH', 'appYoLbase/tblltable', {
			records: [{ fields: { bar: 'bar 1', foo: 'foo 1' }, id: 'recXXX' }],
			typecast: false,
		});
	});

	it('should update a record by field name, autoMapInputData', async () => {
		const nodeParameters = {
			operation: 'update',
			dataMode: 'autoMapInputData',
			columnToMatchOn: 'foo',
			options: {},
		};

		const items = [
			{
				json: {
					id: 'recXXX',
					foo: 'foo 1',
					bar: 'bar 1',
				},
			},
		];

		await update.execute.call(
			createMockExecuteFunction(nodeParameters),
			items,
			'appYoLbase',
			'tblltable',
		);

		expect(transport.apiRequest).toHaveBeenCalledWith('PATCH', 'appYoLbase/tblltable', {
			records: [{ fields: { bar: 'bar 1', foo: 'foo 1', id: 'recXXX' }, id: 'recXXX' }],
			typecast: false,
		});
	});
});
