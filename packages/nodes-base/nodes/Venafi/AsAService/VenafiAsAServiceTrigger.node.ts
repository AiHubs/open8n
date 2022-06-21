import {
	IPollFunctions,
} from 'n8n-core';

import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import moment from 'moment';

import {
	venafiApiRequest,
} from './GenericFunctions';

export class VenafiAsAServiceTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Venafi As a Service Trigger',
		name: 'venafiAsAServiceTrigger',
		icon: 'file:../Tpp/venafi.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when Venafi events occure',
		defaults: {
			name: 'Venafi As a Service Trigger',
			color: '#000000',
		},
		credentials: [
			{
				name: 'venafiAsAServiceApi',
				required: true,
			},
		],
		polling: true,
		inputs: [],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Certificate Expired',
						value: 'certificateExpired',
					},
				],
				required: true,
				default: 'certificateExpired',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const webhookData = this.getWorkflowStaticData('node');
		const event = this.getNodeParameter('event') as string;

		const now = moment().format();

		var startDate = webhookData.lastTimeChecked || now;
		const endDate = now;

		const { certificates: certificates } = await venafiApiRequest.call(
			this,
			'POST',
			`/outagedetection/v1/certificatesearch`,
			{
				expression: {
					operands: [
						{
							operator: "AND",
							operands: [
								{
									field: "validityEnd",
									operator: "LTE",
									values: [
										endDate
									]
								},
								{
									field: "validityEnd",
									operator: "GTE",
									values: [
										startDate
									]
								}
							]
						}
					]
				},
				ordering: {
					orders: [
						{
							field: "certificatInstanceModificationDate",
							direction: "DESC"
						}
					]
				}
			},
			{},
		);

		webhookData.lastTimeChecked = endDate;

		if (Array.isArray(certificates) && certificates.length) {
			return [this.helpers.returnJsonArray(certificates)];
		}

		return null;
	}
}
