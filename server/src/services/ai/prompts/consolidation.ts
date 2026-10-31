export const CONSOLIDATION_SYSTEM_PROMPT = `You are an elite, executive-level Minutes of Meeting (MoM) consolidation engine.

Your task is to take multiple chunk-level extraction outputs and consolidate them into a unified, coherent meeting minutes document.

CONSOLIDATION RULES:
1. Meeting Metadata:
   - "meetingTitle": Determine the definitive meeting name/title (e.g. "AIC Meeting", "Executive Committee Meeting").
   - "meetingDate": Determine the meeting date (e.g. "31st August 2026").
   - "meetingTime": Consolidate meeting time duration (e.g. "9:53 AM – 12:07 PM") or null if not stated.
   - "meetingMode": "Online", "In-person", or "Hybrid".
   - "attendees": Combine and deduplicate attendees, speakers, and participants into a single comprehensive comma-separated list, including organization/role in parentheses when available (e.g. "Hemanth MN, Suruchi, Souvik Roy, Akanksha, Abiram, Nandan Prabhudesai, Bibin T, Deepthi, Aryan Kohli, Bhavna, Meenakshi V, Harshdeep Rana, Rajan Gupta, Pavitra (ANNAM.AI), Divya (ANNAM.AI, IIT Ropar)").
   - "notes": Consolidate general notes, data inconsistency warnings, or privacy notes into a coherent caveat sentence, or null if none.

2. Agendas & Hierarchical Numbering:
   - Deduplicate or group related topics across chunks.
   - Assign sequential "slNo" starting at 1 (1, 2, 3... N).
   - Assign hierarchical "agendaPoint" strings (e.g. "1.1", "1.2", "1.3", "2.1", "2.2", "3.1", "3.2"...).
   - "agenda": Descriptive bold title with clear subtopic distinction.

3. "discussionPoints" (Decision taken / Discussion):
   - Combine discussion points and decisions without losing material facts, metrics, ticket numbers, or technical specifics.
   - Present as clean, concise, high-density bullet points.

4. "wayForward" (Way forward / Plan):
   - Consolidate action plans, next steps, owners, and embedded deadlines into crisp, actionable bullet points.

5. "responsiblePerson":
   - Comma-separated list of assigned owners or teams.

6. Evidence & Traceability:
   - Consolidate and preserve valid evidence quotes and sourceSegmentIds. Do not invent new quotes.

7. CRITICAL JSON SYNTAX RULE:
   - NEVER use unescaped double quotes (") inside text strings. Use single quotes (') for terms, quotes, and names.
   - Return strictly valid JSON.

Return ONLY valid JSON matching the schema.`;

export function buildConsolidationPrompt(chunkResultsJson: string): string {
  return `Consolidate the following chunk extraction results into the final meeting minutes:

<chunk_extractions>
${chunkResultsJson}
</chunk_extractions>

Format strictly as:
{
  "meetingTitle": "AIC Meeting",
  "meetingDate": "31st August 2026",
  "meetingTime": "9:53 AM – 12:07 PM",
  "meetingMode": "Online",
  "attendees": "Hemanth MN, Suruchi, Souvik Roy, Akanksha, Abiram, Nandan Prabhudesai, Bibin T, Deepthi, Aryan Kohli, Bhavna, Meenakshi V, Harshdeep Rana, Rajan Gupta, Pavitra (ANNAM.AI), Divya (ANNAM.AI, IIT Ropar)",
  "notes": "Note: a few figures in the GDB/RDQA metrics segment were inconsistently stated in the recording (flagged in row 15) and should be cross-checked against the slide deck. Personal/family details shared in the on-site-mandate discussion (row 23) have been generalized to protect privacy.",
  "minutes": [
    {
      "slNo": 1,
      "agendaPoint": "1.1",
      "agenda": "Central Team Coordination — Sarvam Bhashani / ACC Workshop",
      "discussionPoints": [
        "Sarvam Bhashani follow-up in progress via Dr. Mukesh Kisthawal; an in-person meeting with Sarvam (and Murf AI) to be planned around the team's upcoming Bangalore visit.",
        "Central team requested a hands-on ACC + Anveshan demo workshop (~1 hour) so they can experience the product firsthand for advocacy/pitching purposes."
      ],
      "wayForward": [
        "Central team (incl. Sonali, PPSR) to be scheduled for the workshop at the earliest, ideally next day, pending their availability.",
        "Separately: a half-day cross-vertical workshop to be organized so all three verticals present their work and identify collaboration/synergy areas — central team to confirm timing."
      ],
      "decisionMade": "Not specified",
      "responsiblePerson": "Divya (IIT Ropar), Hemanth, Suruchi",
      "timeline": "Not specified",
      "evidence": [
        {
          "quote": "verbatim text",
          "sourceSegmentId": "seg_X",
          "supportsField": "discussion"
        }
      ],
      "uncertaintyNotes": []
    }
  ]
}`;
}
