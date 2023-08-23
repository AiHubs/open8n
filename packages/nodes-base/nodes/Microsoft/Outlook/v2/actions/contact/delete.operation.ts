import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { microsoftApiRequest } from '../../transport';

export const description: INodeProperties[] = [];

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const contactId = this.getNodeParameter('contactId', index) as string;
	await microsoftApiRequest.call(this, 'DELETE', `/contacts/${contactId}`);

	const executionData = this.helpers.constructExecutionMetaData(
		this.helpers.returnJsonArray({ success: true }),
		{ itemData: { item: index } },
	);

	return executionData;
}
