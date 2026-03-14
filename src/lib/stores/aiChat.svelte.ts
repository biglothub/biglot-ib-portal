/** Persists AI chat messages across page navigation within the portfolio section */

interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

let messages = $state<ChatMessage[]>([]);

export function getAiChatMessages(): ChatMessage[] {
	return messages;
}

export function addAiChatMessage(msg: ChatMessage) {
	messages.push(msg);
}

export function updateLastAiChatMessage(content: string) {
	if (messages.length > 0) {
		messages[messages.length - 1].content = content;
	}
}

export function removeLastAiChatMessage() {
	messages.pop();
}

export function clearAiChat() {
	messages = [];
}
