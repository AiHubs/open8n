import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from '../../../../../utils/utilities';
import { parseDiscordError, prepareErrorData } from '../../helpers/utils';
import { discordApiRequest } from '../../transport';
import { channelRLC, messageIdString } from '../common.description';

const properties: INodeProperties[] = [channelRLC, messageIdString];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['deleteMessage'],
	},
	hide: {
		authentication: ['webhook'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(this: IExecuteFunctions): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const items = this.getInputData();

	for (let i = 0; i < items.length; i++) {
		try {
			const channelId = this.getNodeParameter('channelId', i, undefined, {
				extractValue: true,
			}) as string;

			const messageId = this.getNodeParameter('messageId', i) as string;

			await discordApiRequest.call(this, 'DELETE', `/channels/${channelId}/messages/${messageId}`);

			const executionData = this.helpers.constructExecutionMetaData(
				this.helpers.returnJsonArray({ success: true }),
				{ itemData: { item: i } },
			);

			returnData.push(...executionData);
		} catch (error) {
			const err = parseDiscordError.call(this, error, i);

			if (this.continueOnFail()) {
				returnData.push(...prepareErrorData.call(this, err, i));
				continue;
			}

			throw err;
		}
	}

	return returnData;
}
