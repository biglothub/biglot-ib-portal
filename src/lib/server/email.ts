import { env } from '$env/dynamic/private';

export interface EmailPayload {
	to: string;
	subject: string;
	html: string;
}

/**
 * Send a transactional email via the Resend API.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL in env.
 * Silently no-ops when the key is not configured (dev environment).
 */
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; error?: string }> {
	const apiKey = env.RESEND_API_KEY;
	const from = env.RESEND_FROM_EMAIL || 'IB Portal <reports@ibportal.com>';

	if (!apiKey) {
		return { ok: false, error: 'RESEND_API_KEY not configured' };
	}

	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from,
				to: [payload.to],
				subject: payload.subject,
				html: payload.html
			})
		});

		if (!res.ok) {
			const body = await res.text();
			return { ok: false, error: body };
		}

		return { ok: true };
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message };
	}
}

// ---------------------------------------------------------------------------
// Email template builders
// ---------------------------------------------------------------------------

function pnlColor(value: number): string {
	return value >= 0 ? '#22c55e' : '#ef4444';
}

function fmt(value: number, decimals = 2): string {
	return value.toFixed(decimals);
}

function fmtSign(value: number): string {
	return (value >= 0 ? '+' : '') + fmt(value);
}

interface DailyReportData {
	userName: string;
	date: string; // Thai date string, e.g. "21 มี.ค. 2569"
	netPnl: number;
	totalTrades: number;
	winningTrades: number;
	losingTrades: number;
	winRate: number; // 0-100
	profitFactor: number;
	avgWin: number;
	avgLoss: number; // positive value
	ruleBreaks: number;
	journalCompleted: boolean;
	topWinner: { symbol: string; profit: number } | null;
	topLoser: { symbol: string; profit: number } | null;
	checklistCompleted: number;
	checklistTotal: number;
}

export function buildDailyReportHtml(data: DailyReportData): string {
	const {
		userName,
		date,
		netPnl,
		totalTrades,
		winningTrades,
		losingTrades,
		winRate,
		profitFactor,
		avgWin,
		avgLoss,
		ruleBreaks,
		journalCompleted,
		topWinner,
		topLoser,
		checklistCompleted,
		checklistTotal
	} = data;

	const pnlColorStr = pnlColor(netPnl);
	const checklistPct = checklistTotal > 0 ? Math.round((checklistCompleted / checklistTotal) * 100) : 0;

	return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>สรุปผลการเทรดรายวัน — ${date}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#1a1d2e;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #2a2d3e;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:#818cf8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">IB Portal</div>
                <div style="color:#e2e8f0;font-size:20px;font-weight:700;margin-top:4px;">สรุปผลการเทรดรายวัน</div>
                <div style="color:#64748b;font-size:13px;margin-top:2px;">${date}</div>
              </td>
              <td align="right">
                <div style="color:#64748b;font-size:13px;">สวัสดี, ${userName}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Net P&L Hero -->
      <tr>
        <td style="background:#1a1d2e;padding:28px 32px;">
          <div style="text-align:center;">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">กำไร/ขาดทุนสุทธิวันนี้</div>
            <div style="color:${pnlColorStr};font-size:42px;font-weight:800;margin-top:8px;letter-spacing:-1px;">${fmtSign(netPnl)} USD</div>
            <div style="margin-top:12px;display:inline-block;background:${netPnl >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${pnlColorStr};border-radius:20px;padding:4px 16px;">
              <span style="color:${pnlColorStr};font-size:13px;font-weight:600;">${netPnl >= 0 ? 'วันที่ทำกำไร ✓' : 'วันที่ขาดทุน'}</span>
            </div>
          </div>
        </td>
      </tr>

      <!-- KPI Grid -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Trades -->
              <td width="33%" style="padding:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:16px;text-align:center;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">การเทรด</div>
                  <div style="color:#e2e8f0;font-size:24px;font-weight:700;margin-top:4px;">${totalTrades}</div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">ชนะ ${winningTrades} / แพ้ ${losingTrades}</div>
                </div>
              </td>
              <!-- Win Rate -->
              <td width="33%" style="padding:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:16px;text-align:center;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Win Rate</div>
                  <div style="color:${winRate >= 50 ? '#22c55e' : '#f59e0b'};font-size:24px;font-weight:700;margin-top:4px;">${fmt(winRate, 1)}%</div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">Profit Factor ${profitFactor >= 999 ? '∞' : fmt(profitFactor)}</div>
                </div>
              </td>
              <!-- Avg Win/Loss -->
              <td width="33%" style="padding:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:16px;text-align:center;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Avg Win / Loss</div>
                  <div style="color:#22c55e;font-size:16px;font-weight:700;margin-top:4px;">+${fmt(avgWin)}</div>
                  <div style="color:#ef4444;font-size:16px;font-weight:700;">-${fmt(avgLoss)}</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Top Trades -->
      ${(topWinner || topLoser) ? `
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 24px;">
          <div style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">เทรดที่โดดเด่น</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${topWinner ? `
              <td width="50%" style="padding-right:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-left:3px solid #22c55e;border-radius:8px;padding:14px 16px;">
                  <div style="color:#22c55e;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">เทรดที่ดีที่สุด</div>
                  <div style="color:#e2e8f0;font-size:16px;font-weight:700;margin-top:4px;">${topWinner.symbol}</div>
                  <div style="color:#22c55e;font-size:14px;font-weight:600;">+${fmt(topWinner.profit)} USD</div>
                </div>
              </td>` : '<td width="50%"></td>'}
              ${topLoser ? `
              <td width="50%" style="padding-left:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-left:3px solid #ef4444;border-radius:8px;padding:14px 16px;">
                  <div style="color:#ef4444;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">เทรดที่แย่ที่สุด</div>
                  <div style="color:#e2e8f0;font-size:16px;font-weight:700;margin-top:4px;">${topLoser.symbol}</div>
                  <div style="color:#ef4444;font-size:14px;font-weight:600;">${fmt(topLoser.profit)} USD</div>
                </div>
              </td>` : '<td width="50%"></td>'}
            </tr>
          </table>
        </td>
      </tr>` : ''}

      <!-- Discipline Section -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 28px;">
          <div style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">วินัยการเทรด</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <!-- Rule Breaks -->
              <td width="50%" style="padding-right:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px 16px;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">ทำผิดกฎ</div>
                  <div style="color:${ruleBreaks === 0 ? '#22c55e' : '#f59e0b'};font-size:22px;font-weight:700;margin-top:4px;">${ruleBreaks} ครั้ง</div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">${ruleBreaks === 0 ? 'ยอดเยี่ยม!' : 'ควรระวัง'}</div>
                </div>
              </td>
              <!-- Journal -->
              <td width="50%" style="padding-left:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px 16px;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">จดบันทึก</div>
                  <div style="color:${journalCompleted ? '#22c55e' : '#64748b'};font-size:22px;font-weight:700;margin-top:4px;">${journalCompleted ? 'เสร็จแล้ว ✓' : 'ยังไม่ได้ทำ'}</div>
                  <div style="color:#64748b;font-size:11px;margin-top:2px;">Checklist ${checklistCompleted}/${checklistTotal} (${checklistPct}%)</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 32px;text-align:center;">
          <a href="${env.PUBLIC_APP_URL || 'https://ibportal.com'}/portfolio"
             style="display:inline-block;background:#818cf8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            ดูรายงานแบบเต็ม
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0f1117;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
          <div style="color:#475569;font-size:12px;line-height:1.6;">
            คุณได้รับอีเมลนี้เพราะเปิดใช้งานรายงานรายวันใน IB Portal<br/>
            <a href="${env.PUBLIC_APP_URL || 'https://ibportal.com'}/settings/email-reports"
               style="color:#818cf8;text-decoration:underline;">จัดการการตั้งค่าอีเมล</a>
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------

interface WeeklyDigestData {
	userName: string;
	weekLabel: string; // e.g. "18–24 มี.ค. 2569"
	netPnl: number;
	totalTrades: number;
	winRate: number;
	profitFactor: number;
	dayWinRate: number;
	topSymbol: { symbol: string; netPnl: number; winRate: number } | null;
	ruleBreakCount: number;
	journalStreak: number;
}

export function buildWeeklyDigestHtml(data: WeeklyDigestData): string {
	const {
		userName,
		weekLabel,
		netPnl,
		totalTrades,
		winRate,
		profitFactor,
		dayWinRate,
		topSymbol,
		ruleBreakCount,
		journalStreak
	} = data;

	const pnlColorStr = pnlColor(netPnl);

	return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>สรุปผลการเทรดรายสัปดาห์ — ${weekLabel}</title>
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:'Helvetica Neue',Arial,sans-serif;color:#e2e8f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:#1a1d2e;border-radius:12px 12px 0 0;padding:24px 32px;border-bottom:1px solid #2a2d3e;">
          <div style="color:#818cf8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">IB Portal</div>
          <div style="color:#e2e8f0;font-size:20px;font-weight:700;margin-top:4px;">สรุปรายสัปดาห์</div>
          <div style="color:#64748b;font-size:13px;margin-top:2px;">${weekLabel} · สวัสดี, ${userName}</div>
        </td>
      </tr>

      <!-- Net P&L -->
      <tr>
        <td style="background:#1a1d2e;padding:28px 32px 0;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">กำไร/ขาดทุนสุทธิสัปดาห์นี้</div>
            <div style="color:${pnlColorStr};font-size:40px;font-weight:800;margin-top:8px;">${fmtSign(netPnl)} USD</div>
          </div>
        </td>
      </tr>

      <!-- Stats Grid -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="25%" style="padding:6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px;text-align:center;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;">เทรด</div>
                  <div style="color:#e2e8f0;font-size:20px;font-weight:700;margin-top:4px;">${totalTrades}</div>
                </div>
              </td>
              <td width="25%" style="padding:6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px;text-align:center;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;">Win Rate</div>
                  <div style="color:${winRate >= 50 ? '#22c55e' : '#f59e0b'};font-size:20px;font-weight:700;margin-top:4px;">${fmt(winRate, 1)}%</div>
                </div>
              </td>
              <td width="25%" style="padding:6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px;text-align:center;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;">Profit Factor</div>
                  <div style="color:#e2e8f0;font-size:20px;font-weight:700;margin-top:4px;">${profitFactor >= 999 ? '∞' : fmt(profitFactor)}</div>
                </div>
              </td>
              <td width="25%" style="padding:6px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px;text-align:center;">
                  <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase;">Day Win%</div>
                  <div style="color:${dayWinRate >= 50 ? '#22c55e' : '#f59e0b'};font-size:20px;font-weight:700;margin-top:4px;">${fmt(dayWinRate, 1)}%</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Top Symbol + Discipline Row -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              ${topSymbol ? `
              <td width="50%" style="padding-right:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-left:3px solid #818cf8;border-radius:8px;padding:14px 16px;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">Symbol ที่ดีที่สุด</div>
                  <div style="color:#e2e8f0;font-size:18px;font-weight:700;margin-top:4px;">${topSymbol.symbol}</div>
                  <div style="color:${pnlColor(topSymbol.netPnl)};font-size:13px;">${fmtSign(topSymbol.netPnl)} USD · ${fmt(topSymbol.winRate, 1)}% WR</div>
                </div>
              </td>` : '<td width="50%"></td>'}
              <td width="50%" style="padding-left:8px;">
                <div style="background:#0f1117;border:1px solid #2a2d3e;border-radius:8px;padding:14px 16px;">
                  <div style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;">วินัย</div>
                  <div style="color:#e2e8f0;font-size:14px;margin-top:6px;">ทำผิดกฎ: <span style="color:${ruleBreakCount === 0 ? '#22c55e' : '#f59e0b'};font-weight:700;">${ruleBreakCount} ครั้ง</span></div>
                  <div style="color:#e2e8f0;font-size:14px;margin-top:2px;">Journal Streak: <span style="color:#818cf8;font-weight:700;">${journalStreak} วัน</span></div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#1a1d2e;padding:0 32px 32px;text-align:center;">
          <a href="${env.PUBLIC_APP_URL || 'https://ibportal.com'}/portfolio/analytics"
             style="display:inline-block;background:#818cf8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
            ดูรายงานรายสัปดาห์แบบเต็ม
          </a>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#0f1117;border-radius:0 0 12px 12px;padding:20px 32px;text-align:center;">
          <div style="color:#475569;font-size:12px;line-height:1.6;">
            คุณได้รับอีเมลนี้เพราะเปิดใช้งานสรุปรายสัปดาห์ใน IB Portal<br/>
            <a href="${env.PUBLIC_APP_URL || 'https://ibportal.com'}/settings/email-reports"
               style="color:#818cf8;text-decoration:underline;">จัดการการตั้งค่าอีเมล</a>
          </div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
