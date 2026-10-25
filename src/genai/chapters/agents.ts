import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en } from '../helpers'

const md = String.raw
const tick = '`'
const json = (s: string) => `${tick.repeat(3)}json\n${s}\n${tick.repeat(3)}`

const compounding: MathExercise = {
  id: 'gen-agent-reliability',
  title: 'Why long agents fail',
  skill: 'Compounding errors: pⁿ',
  level: 2,
  generate: (r) => {
    const p = r.pick([0.9, 0.95, 0.97, 0.98, 0.99])
    const n = r.pick([5, 10, 20])
    const target = r.pick([0.8, 0.9])
    const maxSteps = Math.floor(Math.log(target) / Math.log(p))
    return {
      params: { p, n, target },
      statement: md`An agent processes a supplier claim in **${n} steps** (read email, look up the order, check the contract, compute the refund…). Each step succeeds with probability **${en(p)}**, independently.

1. Probability that the whole run succeeds?
2. What is the **maximum number of steps** the agent can have while keeping a success rate of at least **${en(target)}**?`,
      fields: [field(`$P(\\text{${n} steps succeed})$`, p ** n, 3), field('Maximum number of steps', maxSteps, 0)],
      hint: md`Independent steps: $P(\text{all succeed}) = p^n$. For the maximum, solve $p^n \ge \text{target}$, i.e. $n \le \dfrac{\ln(\text{target})}{\ln(p)}$ (both logs are negative), and round down.`,
      solution: md`$$${en(p)}^{${n}} \approx ${en(p ** n, 4)}$$

$$n \le \frac{\ln ${en(target)}}{\ln ${en(p)}} = \frac{${en(Math.log(target), 4)}}{${en(Math.log(p), 4)}} \approx ${en(Math.log(target) / Math.log(p), 2)} \quad\Rightarrow\quad n_{\max} = ${maxSteps}$$

Errors **compound**: a 95 %-reliable step sounds great, but 20 of them succeed together only about 36 % of the time. This is why reliable systems keep agents short, use **fixed workflows** where the path is known, validate intermediate results in code, and let a human check the risky steps.`,
    }
  },
}

export const agentsChapter: Chapter = {
  id: 'gen-agents',
  title: 'Tools & agents',
  emoji: '🤖',
  summary: 'Function calling, the agent loop, workflows vs agents, reliability, cost and safety of letting a model act.',
  lesson: md`## From answering to acting

On its own, an LLM only produces text. With **tools** it can look up an order in a database, call a pricing API, run Python, search documents or create a ticket. This turns an assistant into something that **acts**.

## Function (tool) calling

1. You describe the available tools to the model: name, purpose, parameters (as a JSON schema).
2. The model decides it needs one and outputs a **structured call** instead of text:

${json('{"tool": "get_order", "arguments": {"order_id": "A-1042"}}')}

3. **Your code** executes the call (the model never runs anything itself), checks permissions, and sends the result back.
4. The model continues with the result: answers, or calls another tool.

Typical tools: search (RAG), database queries, calculators and code execution, CRM/ERP APIs, sending emails or creating tickets.

## The agent loop

An **agent** is a model that runs this loop on its own: **think → choose a tool → observe the result → repeat**, until it decides the task is done (often called the ReAct pattern: reason + act). It can plan, break a task into steps, and recover from some errors.

## Workflow or agent?

| | Workflow (fixed steps in code) | Agent (the model chooses the steps) |
|---|---|---|
| When | the process is known and repeatable | the path depends on the case and cannot be listed in advance |
| Reliability | high, testable step by step | lower: errors compound, behaviour varies |
| Cost and latency | predictable | variable: many calls, growing context |
| Example | classify email → extract fields → create ticket | investigate an unusual customer dispute across several systems |

**Default to the simplest thing that works**: a single prompt, then a fixed chain of prompts (workflow), and only then an agent. Most enterprise value today comes from well-designed workflows with a few tools.

## Risks specific to agents

- **Compounding errors**: with $n$ steps of reliability $p$, the whole run succeeds with probability $p^n$.
- **Loops and runaway cost**: always cap the number of steps, tokens and time.
- **Dangerous actions**: payments, deletions, emails to customers. Use least privilege, dry runs, and **human approval** for irreversible actions.
- **Prompt injection through tool results**: a web page or document read by the agent can contain instructions (chapter 5).
- **Hard to debug**: log every step (inputs, tool calls, outputs) so you can trace what happened.

## In a client conversation

> "We will automate the steps that are always the same as a fixed workflow, and only let the model decide where it really adds value. Anything that moves money or writes to a customer goes through a human approval at first."`,
  formulas: [
    { name: 'Success of n independent steps', tex: md`P(\text{success}) = p^n` },
    { name: 'Maximum steps for a target', tex: md`n_{\max} = \left\lfloor \frac{\ln(\text{target})}{\ln p} \right\rfloor` },
  ],
  exercises: [
    conceptQuiz('gen-tools', 'Function calling', 'How tools work', 1, [
      {
        q: 'When a model "calls a tool", who actually executes it?',
        options: [
          ["Your application code, from the model's structured request", "Correct: the model only outputs a tool name and arguments; you stay in control of execution, permissions and errors."],
          ["The model, inside the provider's secure data centre", "The model only generates text; it cannot run your systems."],
          ["The provider's API, which connects directly to your systems", "The API returns the request to you; your code calls your systems."],
          ["The tool itself, which listens to the model's output", "Your code parses the request and calls the tool."],
        ],
        takeaway: 'Tool calling: the model proposes a call, your code executes it and returns the result.',
      },
      {
        q: 'Why give the model a calculator or a Python tool?',
        options: [
          ["Exact arithmetic and data processing are unreliable in text generation", "Correct: let code do what code is good at."],
          ["Models cannot read numbers, so they need a tool to convert them first", "They can read numbers; they are just unreliable at computing with them."],
          ["Tool calls are cheaper than generating the answer, so overall costs go down", "Tool calls add a round trip; the reason is reliability, not cost."],
          ["It lets the model learn the formulas so it no longer needs the tool", "Nothing is learned from tool calls; the weights do not change."],
        ],
        takeaway: 'Use tools for exact operations: arithmetic, database queries, code.',
      },
      {
        q: 'The model calls get_order with the argument order_id = "last week". What should your code do?',
        options: [
          ["Validate it and send an error back so the model can ask or retry", "Correct: never trust tool arguments blindly; validation errors are useful feedback."],
          ["Pass it to the database as it is and let the query fail if needed", "Invalid input could break things or be exploited."],
          ["Interpret it in code as the most recent order placed last week", "Guessing can return the wrong customer's order; ask instead."],
          ["Stop the conversation and show a technical error to the user", "Handle the error gracefully: the model can recover by asking."],
        ],
        takeaway: 'Validate tool arguments in code; send clear errors back to the model.',
      },
      {
        q: 'Which tool should require human confirmation before execution?',
        options: [
          ["Issuing a refund to a customer", "Correct: irreversible, with a financial impact."],
          ["Searching the internal knowledge base", "Read-only and harmless."],
          ["Looking up a customer's order history", "Read-only (with access control), so no confirmation needed."],
          ["Drafting an email for the agent to review", "A draft is reviewed before sending: already human-approved."],
        ],
        takeaway: 'Human approval for irreversible or sensitive actions (money, deletion, external messages).',
      },
    ]),
    conceptQuiz('gen-agent-design', 'Workflow or agent?', 'Choosing the right architecture', 3, [
      {
        q: 'An insurer processes 5,000 identical address-change requests per month: read the form, validate the address, update the CRM. Best design?',
        options: [
          ["A fixed workflow: LLM extraction, then validation and update in code", "Correct: the steps are known; a workflow is cheaper, more reliable and testable."],
          ["An autonomous agent with CRM access that handles each request itself", "Unnecessary freedom adds cost and risk for a fixed process."],
          ["A multi-agent system: one agent extracts the data, another reviews its work", "Over-engineering for a simple process; a review in code is cheaper and exact."],
          ["A chatbot where customers type their new address in a conversation", "It changes the channel; the forms still arrive and must be processed."],
        ],
        takeaway: 'Known, repeatable process → workflow. Keep agents for open-ended tasks.',
      },
      {
        q: 'Your agent sometimes runs 40 tool calls on a simple question and the bill explodes. First fix?',
        options: [
          ["Cap steps, tokens and time, and read the traces", "Correct: hard limits first, then fix the root cause from the traces."],
          ["Switch to a more capable, more expensive model", "May reduce loops, but does not bound the cost."],
          ["Remove the tools it calls most often", "Then it may not be able to do the task at all."],
          ["Raise the temperature to break out of loops", "More randomness, more erratic behaviour."],
        ],
        takeaway: 'Always bound agents (steps, tokens, time) and log every step.',
      },
      {
        q: 'Each step of a 10-step agent is 95 % reliable. Roughly how often does a full run succeed?',
        options: [
          ["About 60 %", "Correct: 0.95¹⁰ ≈ 0.60."],
          ["About 95 %", "That ignores compounding over 10 steps."],
          ["About 50 %", "Close, but 0.95¹⁰ ≈ 0.60."],
          ["About 85 %", "Too optimistic: errors compound, 0.95¹⁰ ≈ 0.60."],
        ],
        takeaway: 'Reliability compounds: pⁿ. Shorter chains and validated steps are more robust.',
      },
      {
        q: 'Which is the most convincing first deliverable for a client curious about "agents"?',
        options: [
          ["A narrow workflow on one real process, measured, with a human in the loop", "Correct: value quickly, risk controlled, results measurable."],
          ["A general-purpose agent that employees can ask to do anything for them", "Impossible to evaluate or secure, and likely to disappoint."],
          ["A multi-agent platform that the client can reuse for all of its future use cases", "A platform before a first proven use case is a bet without evidence."],
          ["An agent that fully replaces one team's process from day one", "High risk; start with assistance, then automate what proves reliable."],
        ],
        takeaway: 'Start narrow and measurable, keep humans in the loop, expand with evidence.',
      },
    ]),
    compounding,
  ],
}
