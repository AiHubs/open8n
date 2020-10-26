import {
  IExecuteFunctions,
} from 'n8n-core';

import {
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';

import {
  uprocApiRequest,
} from './GenericFunctions';

import {
  groupOptions,
} from './GroupDescription';

import {
  toolOperations,
  toolParameters,
} from './ToolDescription';

import { OptionsWithUri } from 'request';

export class UProc implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'UProc',
    name: 'uproc',
    icon: 'file:uproc.png',
    group: ['output'],
    version: 1,
    subtitle: '={{$parameter["tool"]}}',
    description: 'Consume uProc API',
    defaults: {
      name: 'UProc',
      color: '#219ef9',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'uprocApi',
        required: true,
      },
    ],
    properties: [
      ...groupOptions,
      ...toolOperations,
      ...toolParameters,
      {
        displayName: 'Additional Options',
        name: 'additionalOptions',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        displayOptions: {
          show: {
            group: [
              'audio',
              'communication',
              'company',
              'finance',
              'geographic',
              'image',
              'internet',
              'personal',
              'product',
              'security',
              'text',
            ],
          },
        },
        options: [
          {
            displayName: 'Start Webhook',
            name: 'startWebhook',
            type: 'string',
            description: 'URL to send "Start notification" when tool has started your request. You can create your own webhook at en <a href="https://beeceptor.com" target="_blank">Beeceptor</a>, <a href="https://www.integromat.com/" target="_blank">Integromat</a>, <a href="https://zapier.com/" target="_blank">Zapier</a> or <a href="https://n8n.io/" target="_blank">n8n</a>',
            default: '',
          },
          {
            displayName: 'End Webhook',
            name: 'endWebhook',
            type: 'string',
            description: 'URL to send "End notification" when tool has ended your request. You can create your own webhook at en <a href="https://beeceptor.com" target="_blank">Beeceptor</a>, <a href="https://www.integromat.com/" target="_blank">Integromat</a>, <a href="https://zapier.com/" target="_blank">Zapier</a> or <a href="https://n8n.io/" target="_blank">n8n</a>',
            default: '',
          },
          {
            displayName: 'Data Webhook',
            name: 'dataWebhook',
            type: 'string',
            description: 'URL to send "Data notification" when tool has resolved your request. You can create your own webhook at en <a href="https://beeceptor.com" target="_blank">Beeceptor</a>, <a href="https://www.integromat.com/" target="_blank">Integromat</a>, <a href="https://zapier.com/" target="_blank">Zapier</a> or <a href="https://n8n.io/" target="_blank">n8n</a>',
            default: '',
          }
        ]
      }
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: IDataObject[] = [];
    const length = items.length as unknown as number;
    let responseData;
    const group = this.getNodeParameter('group', 0) as string;
    const tool = this.getNodeParameter('tool', 0) as string;
    const additionalOptions = this.getNodeParameter('additionalOptions', 0) as IDataObject;


    const startWebhook = additionalOptions.startWebhook as string;
    const progressWebhook = additionalOptions.progressWebhook as string;
    const endWebhook = additionalOptions.endWebhook as string;
    const dataWebhook = additionalOptions.dataWebhook as string;

    interface LooseObject {
      [key: string]: any;
    }

    const fields = toolParameters.filter((field) => {
      return field && field.displayOptions && field.displayOptions.show && field.displayOptions.show.group && field.displayOptions.show.tool &&
        field.displayOptions.show.group.indexOf(group) !== -1 && field.displayOptions.show.tool.indexOf(tool) !== -1;
    }).map((field) => {
      return field.name;
    });

    const requestPromises = [];
    for (let i = 0; i < length; i++) {
      const body: LooseObject = {
        processor: tool.replace(/ /g, "-").toLowerCase(),
        params: {}
      };

      fields.forEach((field) => {
        if (field && field.length) {
          const data = this.getNodeParameter(field, i) as string;
          body.params[field] = data;
        }
      });

      if (startWebhook && startWebhook.length || progressWebhook && progressWebhook.length || endWebhook && endWebhook.length || dataWebhook && dataWebhook.length) {
        body.callback = {};
      }

      if (startWebhook && startWebhook.length) {
        body.callback.start = startWebhook;
      }
      if (progressWebhook && progressWebhook.length) {
        body.callback.progress = progressWebhook;
      }
      if (endWebhook && endWebhook.length) {
        body.callback.end = endWebhook;
      }
      if (dataWebhook && dataWebhook.length) {
        body.callback.data = dataWebhook;
      }


      //Change to multiple requests
      responseData = await uprocApiRequest.call(this, 'POST', body);

      if (Array.isArray(responseData)) {
        returnData.push.apply(returnData, responseData as IDataObject[]);
      } else {
        returnData.push(responseData as IDataObject);
      }
    }
    return [this.helpers.returnJsonArray(returnData)];
  }
}
