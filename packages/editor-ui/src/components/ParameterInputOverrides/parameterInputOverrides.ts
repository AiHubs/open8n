import {
	extractFromAICalls,
	type INodeTypeDescription,
	type NodeParameterValueType,
	type NodePropertyTypes,
} from 'n8n-workflow';
import { i18n } from '@/plugins/i18n';

export interface ParameterOverride {
	readonly overridePlaceholder: string;
	readonly extraProps: Record<string, ExtraPropValue>;
	extraPropValues: Partial<Record<keyof ParameterOverride['extraProps'], NodeParameterValueType>>;
	buildValueFromOverride: (
		props: Pick<OverrideContext, 'parameter'>,
		excludeMarker: boolean,
	) => string;
	isOverrideValue: (s: string) => boolean;
	parseOverrides: (s: string) => Partial<Record<string, string>> | null;
}

export type OverrideContext = {
	parameter: {
		name: string;
		displayName: string;
		type: NodePropertyTypes;
		noDataExpression?: boolean;
		typeOptions?: { editor?: string };
	};
	value: NodeParameterValueType;
	path: string;
};

type FromAiOverrideExtraProps = 'description';
type ExtraPropValue = {
	initialValue: string;
	tooltip: string;
	type: NodePropertyTypes;
	typeOptions?: { rows?: number };
};

function sanitizeFromAiParameterName(s: string) {
	s = s.replace(/[^a-zA-Z0-9\-]/g, '_');

	if (s.length >= 64) {
		s = s.slice(0, 63);
	}

	return s;
}

export class FromAiOverride implements ParameterOverride {
	static readonly MARKER = '/* n8n-auto-generated-fromAI-override */ ';

	static readonly NODE_DENYLIST = ['toolCode', 'toolHttpRequest'];

	static readonly PATH_DENYLIST = [
		'parameters.name',
		'parameters.description',
		// This is used in e.g. the telegram node if the dropdown selects manual mode
		'parameters.toolDescription',
	];

	readonly overridePlaceholder = i18n.baseText('parameterOverride.overridePanelText');

	readonly extraProps: Record<FromAiOverrideExtraProps, ExtraPropValue> = {
		description: {
			initialValue: '',
			type: 'string',
			typeOptions: { rows: 2 },
			tooltip: i18n.baseText('parameterOverride.descriptionTooltip'),
		},
	};

	extraPropValues: Partial<Record<FromAiOverrideExtraProps, NodeParameterValueType>> = {};

	private fieldTypeToFromAiType(propType: NodePropertyTypes) {
		switch (propType) {
			case 'boolean':
			case 'number':
			case 'json':
				return propType;
			default:
				return 'string';
		}
	}

	static isOverrideValue(s: string) {
		return s.startsWith(`={{ ${FromAiOverride.MARKER}$fromAI(`);
	}

	isOverrideValue = FromAiOverride.isOverrideValue;

	buildValueFromOverride(props: Pick<OverrideContext, 'parameter'>, includeMarker: boolean) {
		const marker = includeMarker ? FromAiOverride.MARKER : '';
		const key = sanitizeFromAiParameterName(props.parameter.displayName);
		const description =
			this.extraPropValues?.description?.toString() ?? this.extraProps.description.initialValue;

		// We want to escape these characters here as the generated formula needs to be valid JS code, and we risk
		// closing the string prematurely without it.
		// If we don't escape \ then 'my \` description' as user input would end up as 'my \\` description'
		// in the generated code, causing an unescaped backtick to close the string.
		const sanitizedDescription = description.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
		const type = this.fieldTypeToFromAiType(props.parameter.type);

		return `={{ ${marker}$fromAI('${key}', \`${sanitizedDescription}\`, '${type}') }}`;
	}

	static parseOverrides(
		s: string,
	): Record<keyof FromAiOverride['extraProps'], string | undefined> | null {
		if (!FromAiOverride.isOverrideValue(s)) return null;

		try {
			const calls = extractFromAICalls(s);
			if (calls.length === 1) {
				return {
					description: calls[0].description,
				};
			}
		} catch (e) {}

		return null;
	}

	parseOverrides = FromAiOverride.parseOverrides;

	static canBeContentOverride(
		props: Pick<OverrideContext, 'path' | 'parameter'>,
		nodeType: INodeTypeDescription | null,
	) {
		if (FromAiOverride.NODE_DENYLIST.some((x) => nodeType?.name?.endsWith(x) ?? false))
			return false;

		if (FromAiOverride.PATH_DENYLIST.includes(props.path)) return false;

		const codex = nodeType?.codex;
		if (!codex?.categories?.includes('AI') || !codex?.subcategories?.AI?.includes('Tools'))
			return false;

		return !props.parameter.noDataExpression && 'options' !== props.parameter.type;
	}
}

export function makeOverrideValue(
	context: OverrideContext,
	nodeType: INodeTypeDescription | null,
): ParameterOverride | null {
	if (!nodeType) return null;

	if (FromAiOverride.canBeContentOverride(context, nodeType)) {
		const fromAiOverride = new FromAiOverride();
		const existingOverrides = fromAiOverride.parseOverrides(context.value?.toString() ?? '');
		for (const [key, value] of Object.entries(existingOverrides ?? {})) {
			if (
				value === undefined ||
				value === fromAiOverride.extraProps[key as FromAiOverrideExtraProps].initialValue
			)
				continue;

			fromAiOverride.extraPropValues[key as FromAiOverrideExtraProps] = value;
		}
		return fromAiOverride;
	}

	return null;
}
