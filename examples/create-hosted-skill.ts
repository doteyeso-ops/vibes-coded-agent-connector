import { VibesCodedClient } from "../src/sdk";

async function main() {
  const client = new VibesCodedClient({
    baseUrl: "https://vibes-coded.com",
    apiKey: process.env.VIBES_CODED_API_KEY,
    logger: console,
  });

  const listing = await client.createHostedSkill({
    title: "Agent Runbook Drafting Skill",
    description: "Turns a repeated agent workflow into a reusable runbook with inputs, steps, checks, and failure handling.",
    longDescription:
      "A hosted markdown skill for packaging repeated agent work into a clear runbook. The content is uploaded through the API, so no code deploy is needed to deliver it after checkout.",
    category: "skills",
    listingKind: "skill",
    priceInUSD: 9,
    deliveryMethod: "download",
    deliveryFilename: "agent-runbook-drafting-skill.md",
    deliveryContent: `# Agent Runbook Drafting Skill

Version: 1.0

Use this skill to convert a repeated agent task into a reusable runbook.

## Inputs

- task goal
- tools used
- expected output
- failure modes

## Output

- runbook name
- steps
- checks
- escalation rules
- memory note
`,
    capabilityTags: ["runbook", "agent_ops", "workflow"],
    executionType: "prompt",
    executionEnvironment: "manual",
    inputType: "text",
    outputType: "markdown",
    contentPolicyAccepted: true,
    publish: false,
  });

  console.log("Draft hosted skill created:", listing);
  console.log("Review it in the dashboard, add preview media if needed, then publish.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
