import { INodeProperties } from 'n8n-workflow';
import { createListOperations, createPaginationProperties, constructODIFilterString } from '../helpers/fields';
import { IExecuteFunctions } from 'n8n-core/dist/src/Interfaces';
import { actionNetworkApiRequest, iterateActionNetworkApiRequest, allPagesActionNetworkApiRequest } from '../helpers/request';
import { IDataObject } from '../../../../workflow/dist/src/Interfaces';
import { createResourceLink, getResourceIDFromURL, addOSDIMetadata } from '../helpers/osdi';

// https://actionnetwork.org/docs/v2/tag
// - Scenario: Retrieving a collection of item resources (GET)
// - Scenario: Retrieving an individual tag resource (GET)
// - Scenario: Creating a new tag (POST)
// - Scenario: Deleting a tag (DELETE)

export const fields: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		default: 'GET',
		description: 'Operation to pertagging',
		options: [
			{
				name: 'Get',
				value: 'GET',
			},
			{
				name: 'Get All by Person',
				value: 'GET_ALL_PERSON',
			},
			{
				name: 'Get All by Tag',
				value: 'GET_ALL_TAG',
			},
			{
				name: 'Create',
				value: 'POST',
			},
			{
				name: 'Delete',
				value: 'DELETE',
			},
			{
				name: 'Delete by Person and Tag',
				value: 'DELETE_BY_PERSON_TAG',
			},
		],
		displayOptions: {
			show: {
				resource: [ 'tagging' ],
			},
		},
	},
	{
		displayName: 'Tag ID',
		name: 'osdi:tag',
		type: 'string',
		default: '',
		required: false,
		displayOptions: {
			show: {
				resource: [ 'tagging' ],
				operation: [ 'POST', 'DELETE', 'DELETE_BY_PERSON_TAG', 'GET_ALL_TAG', 'GET' ]
			},
		},
	},
	{
		displayName: 'Tagging ID',
		name: 'tagging_id',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: [ 'tagging' ],
				operation: [ 'GET', 'DELETE' ]
			},
		},
	},
	{
		name: "osdi:person",
		displayName: "Person ID or URL",
		description: "Link to a person by their ID or URL",
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: [ 'tagging' ],
				operation: [ 'POST', 'GET_ALL_PERSON', 'DELETE_BY_PERSON_TAG' ]
			}
		}
	},
	/**
	 * Listing and getting resources
	 */
	...createListOperations({
		displayOptions: {
			show: {
				resource: [ 'tagging' ],
				operation: [ 'GET_ALL_TAG', 'GET_ALL_PERSON' ],
			}
		}
	})
];

export const resolve = async (node: IExecuteFunctions, i: number) => {
	const operation = node.getNodeParameter('operation', i) as 'GET' | 'DELETE' | 'DELETE_BY_PERSON_TAG' | 'POST' | 'GET_ALL_TAG' | 'GET_ALL_PERSON';

	if (operation === 'GET') {
		const tag_id = node.getNodeParameter('osdi:tag', i) as string;
		const tagging_id = node.getNodeParameter('tagging_id', i) as string;
		return actionNetworkApiRequest.call(node, 'GET', `/api/v2/tags/${tag_id}/taggings/${tagging_id}`) as Promise<IDataObject>
	}

	if (operation === 'DELETE') {
		const tag_id = getResourceIDFromURL('osdi:tag', node.getNodeParameter('osdi:tag', i) as string)
		const tagging_id = node.getNodeParameter('tagging_id', i) as string;
		return actionNetworkApiRequest.call(node, 'DELETE', `/api/v2/tags/${tag_id}/taggings/${tagging_id}`) as Promise<IDataObject>
	}

	if (operation === 'DELETE_BY_PERSON_TAG') {
		// Get taggings for this person
		const person_id = getResourceIDFromURL('osdi:person', node.getNodeParameter('osdi:person', i) as string)
		// Remove taggings where they match this tag_id
		const tag_id = getResourceIDFromURL('osdi:tag', node.getNodeParameter('osdi:tag', i) as string)
		const responses: any[] = []
		for await (const _tagging of iterateActionNetworkApiRequest(node, 'GET', `/api/v2/people/${person_id}/taggings`, 'osdi:taggings')) {
			const tagging = addOSDIMetadata(_tagging)
			const this_tag_id = tagging.identifierDictionary['osdi:tag'].action_network
			if (this_tag_id === tag_id) {
				const tagging_id = tagging.identifierDictionary.self.action_network
				responses.push(await actionNetworkApiRequest.call(node, 'DELETE', `/api/v2/tags/${tag_id}/taggings/${tagging_id}`) as Promise<IDataObject>)
			}
		}
		return responses
	}

	if (operation === 'POST') {
		const tag_id = getResourceIDFromURL('osdi:tag', node.getNodeParameter('osdi:tag', i) as string)
		const personRefURL = node.getNodeParameter('osdi:person', i) as string;
		const body = createResourceLink('osdi:person', personRefURL)
		return actionNetworkApiRequest.call(node, 'POST', `/api/v2/tags/${tag_id}/taggings`, body) as Promise<IDataObject>
	}

	if (operation === 'GET_ALL_PERSON') {
		const personRefURL = node.getNodeParameter('osdi:person', i) as string;
		const person_id = getResourceIDFromURL('osdi:person', personRefURL)
		const url = `/api/v2/people/${person_id}/taggings`
		const qs = createPaginationProperties(node, i)
		return actionNetworkApiRequest.call(node, 'GET', url, undefined, undefined, qs) as Promise<IDataObject[]>
	}

	if (operation === 'GET_ALL_TAG') {
		const tag_id = getResourceIDFromURL('osdi:tag', node.getNodeParameter('osdi:tag', i) as string)
		const url = `/api/v2/tags/${tag_id}/taggings`
		const qs = createPaginationProperties(node, i)
		return actionNetworkApiRequest.call(node, 'GET', url, undefined, undefined, qs) as Promise<IDataObject[]>
	}

	return []
}
