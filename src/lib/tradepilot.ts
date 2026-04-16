import type { BigLotAiChat, BigLotAiMode } from '$lib/types';

export interface TradePilotModeOption {
	value: BigLotAiMode;
	label: string;
	subtitle: string;
	eyebrow: string;
}

export const TRADEPILOT_MODE_OPTIONS: TradePilotModeOption[] = [
	{
		value: 'portfolio',
		label: 'Portfolio Q&A',
		subtitle: 'ถามเรื่อง performance, trades, reports',
		eyebrow: 'Performance'
	},
	{
		value: 'coach',
		label: 'Coach',
		subtitle: 'โฟกัสวินัย, mistakes, recurring patterns',
		eyebrow: 'Discipline'
	},
	{
		value: 'gold',
		label: 'Gold Analyst',
		subtitle: 'วิเคราะห์ XAUUSD ด้วย context ล่าสุด',
		eyebrow: 'XAUUSD'
	},
	{
		value: 'general',
		label: 'General',
		subtitle: 'ใช้เป็นผู้ช่วยทั่วไป แต่ยังยึด account นี้เป็นแกน',
		eyebrow: 'Daily briefing'
	}
];

export const TRADEPILOT_STARTER_PROMPTS: Record<BigLotAiMode, string[]> = {
	portfolio: [
		'สรุปผลงานการเทรด 7 วันล่าสุดให้หน่อย',
		'เทรดคู่เงินไหนทำกำไรดีที่สุดใน 30 วันล่าสุด',
		'ช่วยอธิบายว่าฉันเสียเงินกับ pattern ไหนบ่อยสุด'
	],
	coach: [
		'จุดอ่อนหลักในการเทรดของฉันตอนนี้คืออะไร',
		'ช่วยสรุป recurring mistakes จาก trades และ reviews ล่าสุด',
		'วาง checklist ก่อนเข้าเทรดให้ฉันจากพฤติกรรมที่พลาดบ่อย'
	],
	gold: [
		'สรุป bias ทองคำวันนี้ให้หน่อย',
		'ถ้าจะเทรด XAUUSD วันนี้ควรระวังระดับราคาไหน',
		'เทียบ playbook ของฉันกับ context ทองตอนนี้ให้หน่อย'
	],
	general: [
		'ช่วยสรุปสิ่งที่ฉันควรโฟกัสในวันนี้แบบสั้น ๆ',
		'ช่วยแปลงข้อมูลพอร์ตล่าสุดเป็น daily briefing',
		'ฉันควรคุยกับ AI นี้ยังไงให้ได้ insight ดีที่สุด'
	]
};

export function filterTradePilotChats(chats: BigLotAiChat[], query: string): BigLotAiChat[] {
	const trimmed = query.trim().toLowerCase();
	if (!trimmed) return chats;
	return chats.filter((chat) => (chat.title || 'TradePilot').toLowerCase().includes(trimmed));
}

