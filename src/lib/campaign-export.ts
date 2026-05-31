/**
 * @fileOverview Generates a complete campaign state export as markdown.
 *
 * The output is formatted specifically for dropping into a Claude project —
 * it gives Claude full context on the campaign without any copy-paste.
 *
 * Includes: campaign overview, all session recaps, characters, NPCs,
 * active plot threads (extracted from AI summary), and locations.
 */

import type { Campaign, Session, Character, Npc, Location } from '@/lib/types';

interface CampaignExportData {
  campaign: Campaign;
  sessions: Session[];
  characters: Character[];
  npcs: Npc[];
  locations: Location[];
}

function formatDate(dateVal: any): string {
  if (!dateVal) return '';
  try {
    const date = typeof dateVal === 'string' ? new Date(dateVal) : dateVal?.toDate?.() ?? new Date(dateVal);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export function generateCampaignExport(data: CampaignExportData): string {
  const { campaign, sessions, characters, npcs, locations } = data;

  const sortedSessions = [...sessions].sort((a, b) => a.sessionNumber - b.sessionNumber);
  const latestSession = sortedSessions[sortedSessions.length - 1];

  const lines: string[] = [
    `---`,
    `campaign: ${campaign.name}`,
    `exported: ${new Date().toISOString().split('T')[0]}`,
    `sessions: ${sessions.length}`,
    `characters: ${characters.length}`,
    `---`,
    ``,
    `# ${campaign.name} — Campaign State`,
    ``,
    `> This file is a complete snapshot of the campaign as of Session ${latestSession?.sessionNumber ?? 0}.`,
    `> Drop it into your Claude project to give Claude full campaign context.`,
    ``,
    `## Campaign Overview`,
    ``,
    campaign.description || '_No description._',
    ``,
  ];

  // AI Summary
  if (campaign.aiSummary) {
    lines.push(
      `## Story So Far`,
      ``,
      campaign.aiSummary,
      ``,
    );
  }

  // Session Log — first after summary, most valuable for Claude
  if (sortedSessions.length > 0) {
    lines.push(`## Session Log`, ``);
    for (const s of sortedSessions) {
      const dateStr = formatDate(s.date);
      lines.push(
        `### Session ${s.sessionNumber}${dateStr ? ` — ${dateStr}` : ''}`,
        ``,
        s.summary || '_No summary._',
        ``,
      );
    }
  }

  // Characters
  if (characters.length > 0) {
    lines.push(`## Player Characters`, ``);
    for (const c of characters) {
      lines.push(`### ${c.name}`);
      if (c.class || c.species) {
        lines.push(`**${[c.class, c.species].filter(Boolean).join(' · ')}**`);
      }
      if (c.backstory) lines.push(``, c.backstory);
      if (c.armorClass || c.speed || c.passivePerception) {
        const stats = [
          c.armorClass ? `AC ${c.armorClass}` : null,
          c.speed ? `Speed ${c.speed}` : null,
          c.passivePerception ? `Passive Perception ${c.passivePerception}` : null,
          c.passiveInvestigation ? `Passive Investigation ${c.passiveInvestigation}` : null,
          c.passiveInsight ? `Passive Insight ${c.passiveInsight}` : null,
        ].filter(Boolean);
        lines.push(``, `_${stats.join(' · ')}_`);
      }
      if (c.developmentLog) lines.push(``, `**Development:** ${c.developmentLog}`);
      lines.push(``);
    }
  }

  // NPCs
  if (npcs.length > 0) {
    lines.push(`## NPCs`, ``);
    for (const n of npcs) {
      lines.push(`### ${n.name}`);
      if (n.location) lines.push(`**Location:** ${n.location}`);
      if (n.description) lines.push(``, n.description);
      lines.push(``);
    }
  }

  // Locations
  if (locations.length > 0) {
    lines.push(`## Locations`, ``);
    for (const l of locations) {
      lines.push(`### ${l.name}`);
      if (l.description) lines.push(``, l.description);
      lines.push(``);
    }
  }

  lines.push(
    `---`,
    `*Exported from Grimlore Forge · ${new Date().toLocaleDateString()}*`,
  );

  return lines.join('\n');
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
