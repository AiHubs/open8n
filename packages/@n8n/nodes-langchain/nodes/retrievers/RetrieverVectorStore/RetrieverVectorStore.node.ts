/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import type { IExecuteFunctions, INodeType, INodeTypeDescription, SupplyData } from 'n8n-workflow';
import type { PineconeStore } from 'langchain/vectorstores/pinecone';
import { logWrapper } from '../../../utils/logWrapper';

export class RetrieverVectorStore implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vector Store Retriever',
		name: 'retrieverVectorStore',
		icon: 'fa:box-open',
		group: ['transform'],
		version: 1,
		description: 'Outputs Vector Store as Retriever',
		defaults: {
			name: 'Vector Store Retriever',
			color: '#400080',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Retrievers'],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [
			{
				displayName: 'Vector Store',
				maxConnections: 1,
				type: 'vectorStore',
				required: true,
			},
		],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: ['vectorRetriever'],
		outputNames: ['Vector Retriever'],
		properties: [
			{
				displayName: 'Top K',
				name: 'topK',
				type: 'number',
				default: 4,
				description: 'Number of top results to fetch from vector store',
			},
		],
	};

	async supplyData(this: IExecuteFunctions): Promise<SupplyData> {
		this.logger.verbose('Supplying data for Vector Store Retriever');

		const topK = this.getNodeParameter('topK', 0, 4) as number;
		const vectorStore = (await this.getInputConnectionData('vectorStore', 0)) as PineconeStore;

		const retriever = vectorStore.asRetriever(topK);

		return {
			response: logWrapper(retriever, this),
		};
	}
}
