import type { N8nInput } from 'n8n-design-system';
import type {
	IConnections,
	IDataObject,
	INodeParameters,
	INodeProperties,
	INodeTypeDescription,
	ITelemetryTrackProperties,
} from 'n8n-workflow/src';
import type { RouteLocation } from 'vue-router';
import type {
	AuthenticationModalEventData,
	ExecutionFinishedEventData,
	ExecutionStartedEventData,
	ExpressionEditorEventsData,
	InsertedItemFromExpEditorEventData,
	NodeRemovedEventData,
	NodeTypeChangedEventData,
	OutputModeChangedEventData,
	UpdatedWorkflowSettingsEventData,
	UserSavedCredentialsEventData,
} from '@/hooks';
import type {
	INodeCreateElement,
	INodeUi,
	INodeUpdatePropertiesInformation,
	IPersonalizationLatestVersion,
	IWorkflowDb,
	NodeFilterType,
} from '@/Interface';
import type { ComponentPublicInstance } from 'vue/dist/vue';

export type GenericExternalHooksContext = Record<string, Array<(metadata: IDataObject) => unknown>>;

export interface ExternalHooks {
	parameterInput: {
		mount: Array<
			(meta: { inputFieldRef?: InstanceType<typeof N8nInput>; parameter?: INodeProperties }) => void
		>;
		modeSwitch: Array<(meta: ITelemetryTrackProperties) => void>;
		updated: Array<(meta: { remoteParameterOptions: NodeListOf<Element> }) => void>;
	};
	nodeCreatorSearchBar: {
		mount: Array<(meta: { inputRef: HTMLElement | null }) => void>;
	};
	app: {
		mount: Array<(meta: {}) => void>;
	};
	nodeView: {
		mount: Array<(meta: {}) => void>;
		createNodeActiveChanged: Array<
			(meta: { source?: string; mode: string; createNodeActive: boolean }) => void
		>;
		addNodeButton: Array<(meta: { nodeTypeName: string }) => void>;
		onRunNode: Array<(meta: ITelemetryTrackProperties) => void>;
		onRunWorkflow: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	main: {
		routeChange: Array<(meta: { to: RouteLocation; from: RouteLocation }) => void>;
	};
	credential: {
		saved: Array<(meta: UserSavedCredentialsEventData) => void>;
	};
	copyInput: {
		mounted: Array<(meta: { copyInputValueRef: HTMLElement }) => void>;
	};
	credentialsEdit: {
		credentialTypeChanged: Array<
			(meta: {
				newValue: string;
				setCredentialType: string;
				credentialType: string;
				editCredentials: string;
			}) => void
		>;
		credentialModalOpened: Array<
			(meta: {
				activeNode: INodeUi | null;
				isEditingCredential: boolean;
				credentialType: string | null;
			}) => void
		>;
	};
	credentialsList: {
		mounted: Array<(meta: { tableRef: ComponentPublicInstance }) => void>;
		dialogVisibleChanged: Array<(meta: { dialogVisible: boolean }) => void>;
	};
	credentialsSelectModal: {
		openCredentialType: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	credentialEdit: {
		saveCredential: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	workflowSettings: {
		dialogVisibleChanged: Array<(meta: { dialogVisible: boolean }) => void>;
		saveSettings: Array<(meta: UpdatedWorkflowSettingsEventData) => void>;
	};
	dataDisplay: {
		onDocumentationUrlClick: Array<
			(meta: { nodeType: INodeTypeDescription; documentationUrl: string }) => void
		>;
		nodeTypeChanged: Array<(meta: NodeTypeChangedEventData) => void>;
		nodeEditingFinished: Array<(meta: {}) => void>;
	};
	executionsList: {
		created: Array<(meta: { filtersRef: HTMLElement; tableRef: ComponentPublicInstance }) => void>;
		openDialog: Array<(meta: {}) => void>;
	};
	showMessage: {
		showError: Array<(meta: { title: string; message?: string; errorMessage: string }) => void>;
	};
	expressionEdit: {
		itemSelected: Array<(meta: InsertedItemFromExpEditorEventData) => void>;
		dialogVisibleChanged: Array<(meta: ExpressionEditorEventsData) => void>;
		closeDialog: Array<(meta: ITelemetryTrackProperties) => void>;
		mounted: Array<
			(meta: { expressionInputRef: HTMLElement; expressionOutputRef: HTMLElement }) => void
		>;
	};
	nodeSettings: {
		valueChanged: Array<(meta: AuthenticationModalEventData) => void>;
		credentialSelected: Array<
			(meta: { updateInformation: INodeUpdatePropertiesInformation }) => void
		>;
	};
	workflowRun: {
		runWorkflow: Array<(meta: ExecutionStartedEventData) => void>;
		runError: Array<(meta: { errorMessages: string[]; nodeName: string | undefined }) => void>;
	};
	runData: {
		updated: Array<(meta: { elements: HTMLElement[] }) => void>;
		onTogglePinData: Array<(meta: ITelemetryTrackProperties) => void>;
		onDataPinningSuccess: Array<(meta: ITelemetryTrackProperties) => void>;
		displayModeChanged: Array<(meta: OutputModeChangedEventData) => void>;
	};
	pushConnection: {
		executionFinished: Array<(meta: ExecutionFinishedEventData) => void>;
	};
	node: {
		deleteNode: Array<(meta: NodeRemovedEventData) => void>;
	};
	nodeExecuteButton: {
		onClick: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	workflow: {
		activeChange: Array<(meta: { active: boolean; workflowId: string }) => void>;
		activeChangeCurrent: Array<(meta: { workflowId: string; active: boolean }) => void>;
		afterUpdate: Array<(meta: { workflowData: IWorkflowDb }) => void>;
		open: Array<(meta: { workflowId: string; workflowName: string }) => void>;
	};
	execution: {
		open: Array<(meta: { workflowId: string; workflowName: string; executionId: string }) => void>;
	};
	userInfo: {
		mounted: Array<(meta: { userInfoRef: HTMLElement }) => void>;
	};
	variableSelectorItem: {
		mounted: Array<(meta: { variableSelectorItemRef: HTMLElement }) => void>;
	};
	mainSidebar: {
		mounted: Array<(meta: { userRef: Element }) => void>;
	};
	nodeCreateList: {
		destroyed: Array<(meta: {}) => void>;
		addAction: Array<
			(meta: { node_type?: string; action: string; resource: INodeParameters['resource'] }) => void
		>;
		selectedTypeChanged: Array<(meta: { oldValue: string; newValue: string }) => void>;
		filteredNodeTypesComputed: Array<
			(meta: {
				nodeFilter: string;
				result: INodeCreateElement[];
				selectedType: NodeFilterType;
			}) => void
		>;
		nodeFilterChanged: Array<
			(meta: {
				oldValue: string;
				newValue: string;
				selectedType: NodeFilterType;
				filteredNodes: INodeCreateElement[];
			}) => void
		>;
		onActionsCustmAPIClicked: Array<(meta: { app_identifier?: string }) => void>;
		onViewActions: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	personalizationModal: {
		onSubmit: Array<(meta: IPersonalizationLatestVersion) => void>;
	};
	settingsPersonalView: {
		mounted: Array<(meta: { userRef: HTMLElement }) => void>;
	};
	workflowOpen: {
		mounted: Array<(meta: { tableRef: ComponentPublicInstance }) => void>;
	};
	workflowActivate: {
		updateWorkflowActivation: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	runDataTable: {
		onDragEnd: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	runDataJson: {
		onDragEnd: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	sticky: {
		mounted: Array<(meta: { stickyRef: HTMLElement }) => void>;
	};
	telemetry: {
		currentUserIdChanged: Array<() => void>;
	};
	settingsCommunityNodesView: {
		openInstallModal: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	templatesWorkflowView: {
		openWorkflow: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	templatesCollectionView: {
		onUseWorkflow: Array<(meta: ITelemetryTrackProperties) => void>;
	};
	template: {
		requested: Array<(meta: { templateId: string }) => void>;
		open: Array<
			(meta: {
				templateId: string;
				templateName: string;
				workflow: { nodes: INodeUi[]; connections: IConnections };
			}) => void
		>;
	};
}
