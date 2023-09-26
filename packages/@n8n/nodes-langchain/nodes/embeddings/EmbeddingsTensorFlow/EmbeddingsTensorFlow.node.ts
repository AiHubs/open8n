/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionType,
	type IExecuteFunctions,
	type INodeType,
	type INodeTypeDescription,
	type SupplyData,
} from 'n8n-workflow';
import * as tf from '@tensorflow/tfjs-node';
import { TensorFlowEmbeddings } from 'langchain/embeddings/tensorflow';
import { logWrapper } from '../../../utils/logWrapper';

export class EmbeddingsTensorFlow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings TensorFlow',
		name: 'embeddingsTensorFlow',
		icon: 'file:tensorflow.svg',
		group: ['transform'],
		version: 1,
		description: 'Use Embeddings TensorFlow',
		defaults: {
			name: 'Embeddings TensorFlow',
		},

		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			{
				displayName:
					'The TensorFlow model we use for generating embeddings is using 512-dimensional embeddings. Please make sure to use the same dimensionality for your vector store. Be aware that running this model with high-dimensional embeddings may result in high CPU usage on the machine.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	async supplyData(this: IExecuteFunctions): Promise<SupplyData> {
		this.logger.verbose('Supply data for embeddings tensorflow');
		await tf.setBackend('tensorflow');
		const embeddings = new TensorFlowEmbeddings({ maxConcurrency: Infinity });

		return {
			response: logWrapper(embeddings, this),
		};
	}
}
