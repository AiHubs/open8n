import { computed, nextTick, ref } from 'vue';
import { defineStore } from 'pinia';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage } from '@/types';
import { localStorageSessionIdKey } from '@/constants';
import { useOptions } from '@/composables';
import * as api from '@/api';
import { chatEventBus } from '@/event-buses';

const dummyMessages: ChatMessage[] = [
	{
		id: '0',
		text: 'Hello',
		sender: 'user',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '1',
		text: 'Hello, how are you?',
		sender: 'bot',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '2',
		text: 'I am fine, thanks',
		sender: 'user',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '3',
		text: 'How are you?',
		sender: 'user',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '4',
		text: "I am a bit rusty, but I'll be fine",
		sender: 'bot',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '5',
		text: 'Can you tell me what this app is about?',
		sender: 'user',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
	{
		id: '6',
		text: 'This is a chat app powered by n8n',
		sender: 'bot',
		createdAt: '2021-08-10T12:00:00.000Z',
	},
];

export const useChatStore = defineStore('chat', () => {
	const { options } = useOptions();
	const messages = ref<ChatMessage[]>([]);
	const currentSessionId = ref<string | null>(null);
	const waitingForResponse = ref(false);

	const initialMessages = computed<ChatMessage[]>(() =>
		(options.initialMessages ?? []).map((text) => ({
			id: uuidv4(),
			text,
			sender: 'bot',
			createdAt: new Date().toISOString(),
		})),
	);

	async function sendMessage(text: string) {
		const sentMessage: ChatMessage = {
			id: uuidv4(),
			text,
			sender: 'user',
			createdAt: new Date().toISOString(),
		};

		messages.value.push(sentMessage);
		waitingForResponse.value = true;

		void nextTick(() => {
			chatEventBus.emit('scrollToBottom');
		});

		const sendMessageResponse = await api.sendMessage(
			text,
			currentSessionId.value as string,
			options,
		);

		const receivedMessage: ChatMessage = {
			id: uuidv4(),
			text: sendMessageResponse.output,
			sender: 'bot',
			createdAt: new Date().toISOString(),
		};
		messages.value.push(receivedMessage);

		waitingForResponse.value = false;

		void nextTick(() => {
			chatEventBus.emit('scrollToBottom');
		});
	}

	async function loadPreviousSession() {
		const sessionId = localStorage.getItem(localStorageSessionIdKey) ?? uuidv4();
		const previousMessagesResponse = await api.loadPreviousSession(sessionId, options);
		const timestamp = new Date().toISOString();

		messages.value = (previousMessagesResponse?.data || []).map((message, index) => ({
			id: `${index}`,
			text: message.kwargs.content,
			sender: message.id.includes('HumanMessage') ? 'user' : 'bot',
			createdAt: timestamp,
		}));

		if (messages.value.length) {
			currentSessionId.value = sessionId;
		}

		return sessionId;
	}

	async function startNewSession() {
		currentSessionId.value = uuidv4();

		localStorage.setItem(localStorageSessionIdKey, currentSessionId.value);
	}

	return {
		initialMessages,
		messages,
		currentSessionId,
		waitingForResponse,
		loadPreviousSession,
		startNewSession,
		sendMessage,
	};
});
