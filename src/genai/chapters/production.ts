import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en, enText, usd } from '../helpers'

const md = String.raw

const monthlyCost: MathExercise = {
  id: 'gen-monthly-cost',
  title: 'What will it cost per month?',
  skill: 'Input and output token pricing',
  level: 1,
  generate: (r) => {
    const requests = r.pick([1000, 3000, 8000, 20000])
    const tin = r.pick([1500, 3000, 6000])
    const tout = r.pick([200, 400, 800])
    const pin = r.pick([0.25, 1, 2.5, 3])
    const pout = pin * r.pick([4, 5])
    const perReq = (tin * pin + tout * pout) / 1e6
    return {
      params: { requests, tin, tout, pin, pout },
      statement: md`A customer-service assistant handles **${enText(requests)} requests per day**. Each request sends about **${enText(tin)} input tokens** (instructions + retrieved documents + question) and generates about **${tout} output tokens**. The model costs **${usd(pin)} per million input tokens** and **${usd(pout)} per million output tokens**.

1. Cost of one request, in dollars?
2. Cost per month (30 days), in dollars?`,
      fields: [field('Cost per request ($)', perReq, 5, '$'), field('Cost per month ($)', perReq * requests * 30, 0, '$')],
      hint: md`$\text{cost per request} = \dfrac{\text{input tokens} \times \text{input price} + \text{output tokens} \times \text{output price}}{10^6}$, then multiply by requests per day and by 30.`,
      solution: md`$$\frac{${en(tin)} \times ${en(pin)} + ${tout} \times ${en(pout)}}{10^6} = ${en(perReq, 6)} \text{ dollars per request}$$

$$${en(perReq, 6)} \times ${en(requests)} \times 30 \approx ${en(perReq * requests * 30, 0)} \text{ dollars per month}$$

Output tokens are usually several times more expensive than input tokens, but RAG prompts are long, so **input often dominates the bill**. Levers: fewer or shorter retrieved chunks, a smaller model for easy requests (routing), caching repeated prompt prefixes, and limiting answer length. Prices change fast: always recompute with the client's actual contract.`,
    }
  },
}

const latency: MathExercise = {
  id: 'gen-latency',
  title: 'How long will the user wait?',
  skill: 'Time to first token + generation speed',
  level: 1,
  generate: (r) => {
    const retrieval = r.pick([0.2, 0.3, 0.5])
    const ttft = r.pick([0.4, 0.6, 0.8, 1.2])
    const tokens = r.pick([150, 300, 600])
    const speed = r.pick([40, 60, 100])
    return {
      params: { retrieval, ttft, tokens, speed },
      statement: md`For one answer of your RAG assistant: retrieval takes **${en(retrieval)} s**, the model's **time to first token** is **${en(ttft)} s**, then it generates **${tokens} tokens** at **${speed} tokens/s**.

1. Total time until the full answer is displayed, in seconds?
2. With **streaming** (tokens shown as they are generated), after how many seconds does the user see the first words?`,
      fields: [field('Full answer (s)', retrieval + ttft + tokens / speed, 2, 's'), field('First words with streaming (s)', retrieval + ttft, 2, 's')],
      hint: md`Full time $=$ retrieval $+$ time to first token $+ \dfrac{\text{output tokens}}{\text{tokens per second}}$. With streaming, the user starts reading after retrieval $+$ time to first token.`,
      solution: md`$$${en(retrieval)} + ${en(ttft)} + \frac{${tokens}}{${speed}} = ${en(retrieval + ttft + tokens / speed, 2)} \text{ s} \qquad \text{first words: } ${en(retrieval + ttft, 2)} \text{ s}$$

Generation time grows with the **length of the answer**, so asking for concise answers is the cheapest speed-up. Streaming does not make the model faster, but users perceive it as much faster. For batch jobs (summarising 10,000 documents overnight), latency matters less than throughput and cost.`,
    }
  },
}

const roi: MathExercise = {
  id: 'gen-roi',
  title: 'Is it worth it?',
  skill: 'Value vs cost',
  level: 2,
  generate: (r) => {
    const tickets = r.pick([4000, 10000, 25000])
    const minutes = r.pick([6, 8, 12])
    const saved = r.pick([0.3, 0.4, 0.5])
    const rate = r.pick([30, 40, 50])
    const runCost = r.pick([1500, 3000, 6000])
    const value = (tickets * minutes * saved * rate) / 60
    return {
      params: { tickets, minutes, saved, rate, runCost },
      statement: md`A client's support team handles **${enText(tickets)} tickets per month**, each taking **${minutes} minutes** on average. A drafting assistant would save **${en(saved * 100)} %** of that time. A support agent costs **${usd(rate, 0)} per hour** (fully loaded). Running the assistant (model, hosting, maintenance) costs **${usd(runCost, 0)} per month**.

1. Value of the time saved per month, in dollars?
2. Net monthly benefit, in dollars?`,
      fields: [field('Time saved value ($/month)', value, 0, '$'), field('Net benefit ($/month)', value - runCost, 0, '$')],
      hint: md`Hours saved $= \dfrac{\text{tickets} \times \text{minutes} \times \text{share saved}}{60}$, then multiply by the hourly cost. Net benefit $=$ value $-$ running cost.`,
      solution: md`$$\frac{${en(tickets)} \times ${minutes} \times ${en(saved)}}{60} \times ${rate} = ${en(value, 0)} \text{ dollars} \qquad \text{net} = ${en(value, 0)} - ${en(runCost)} = ${en(value - runCost, 0)}$$

This is the kind of back-of-the-envelope estimate clients expect in the first meeting. State the **assumptions** clearly (share of time saved is the most uncertain one: measure it in a pilot), remember the one-off build cost, and note that time saved only becomes money if it is redeployed (more tickets handled, faster response, less overtime).`,
    }
  },
}

export const productionChapter: Chapter = {
  id: 'gen-production',
  title: 'Cost, latency & choosing a solution',
  emoji: '💰',
  summary: 'Token pricing, latency, model choice, prompt vs RAG vs fine-tuning vs classic ML, build vs buy, and the business case.',
  lesson: md`## Cost: everything is tokens

$$\text{cost per request} = \frac{\text{input tokens} \times \text{input price} + \text{output tokens} \times \text{output price}}{10^6}$$

- Prices are quoted **per million tokens**, and output tokens cost more than input tokens.
- Long prompts (RAG context, few-shot examples, chat history) are paid **on every request**.
- Levers: shorter prompts, fewer chunks, answer length limits, **routing** (a small cheap model for easy requests, a large one for hard ones), **caching** repeated prefixes, **batch** processing for non-urgent jobs.

Always state that prices change quickly and recompute with the actual offer.

## Latency

$$\text{time} \approx \text{retrieval} + \text{time to first token} + \frac{\text{output tokens}}{\text{tokens per second}}$$

Bigger models and longer answers are slower. **Streaming** shows the answer as it is generated; perceived speed matters as much as real speed for chat interfaces.

## Choosing the solution: the ladder

Climb only as high as needed:

1. **Is AI needed at all?** A rule, a form or a dashboard may solve it. Deterministic logic (tax computation, eligibility rules) belongs in code.
2. **Classic ML** for predictions on tabular data (churn, demand, fraud scores): cheaper, more accurate, explainable.
3. **Prompting** an existing LLM for language tasks.
4. **RAG** when answers must come from the client's documents.
5. **Tools / workflows** when the system must look things up or act.
6. **Fine-tuning** when you need a consistent style or narrow behaviour at scale, or to make a small model do what a large one does (cheaper, faster).
7. **Training a model from scratch**: almost never for a client project.

## Model choice

| Question | Trade-off |
|---|---|
| Large or small model? | quality on hard tasks vs cost and speed; test both on the test set |
| API or self-hosted (open-weights) model? | ease and quality vs data control, fixed cost at high volume, on-premise requirements |
| One model or routing? | simplicity vs cost savings |

## Build vs buy

Many needs (meeting notes, generic writing help, coding assistants) are covered by **off-the-shelf** products. Custom builds make sense when the value comes from the client's **own data, processes or integration**. A forward-deployed scientist often adds the most value by **integrating** existing building blocks well and measuring the impact.

## The business case

Value usually comes from **time saved**, **more revenue** (conversion, retention), **lower risk** (errors, compliance) or **better quality**. Estimate it with explicit assumptions, compare it with build and running costs, and confirm it with a **pilot** that measures the real effect.

## In a client conversation

> "For your volume, the model cost is about X per month; the real cost is integration and change management. The value case rests on one assumption, the share of time saved, which we will measure in a four-week pilot with one team before scaling."`,
  formulas: [
    { name: 'Cost per request', tex: md`\frac{t_{in} \times p_{in} + t_{out} \times p_{out}}{10^6}` },
    { name: 'Latency', tex: md`\text{retrieval} + \text{TTFT} + \frac{t_{out}}{\text{tokens/s}}` },
    { name: 'Value of time saved', tex: md`\frac{\text{volume} \times \text{minutes} \times \text{share saved}}{60} \times \text{hourly cost}` },
  ],
  exercises: [
    conceptQuiz('gen-solution-choice', 'Pick the right solution', 'The solution ladder', 2, [
      {
        q: 'A retailer wants to forecast weekly sales per store for the next 8 weeks. Best approach?',
        options: [
          ["A classic forecasting / ML model on sales, calendar and promotions", "Correct: numeric time series are not a GenAI problem."],
          ["An LLM given the sales history in the prompt, asked to forecast", "LLMs are not built for numeric forecasting at scale and are hard to validate here."],
          ["A RAG system that retrieves past sales reports for each store", "Retrieval gives text, not forecasts."],
          ["An LLM agent that writes and runs new forecasting code for each store", "An agent writing new code per store adds risk; build and validate one model instead."],
        ],
        takeaway: 'Numeric prediction on structured data → classic ML / forecasting.',
      },
      {
        q: 'Lawyers need answers about 3,000 internal contracts, with the exact clause quoted. Best approach?',
        options: [
          ["RAG over the contracts, with citations", "Correct: private documents, need for sources."],
          ["Fine-tune a model on the 3,000 contracts", "It does not reliably memorise clauses and cannot cite them."],
          ["Paste all contracts into every prompt", "Far too large for a context window, and very costly."],
          ["A keyword search engine on the contracts", "Useful as part of hybrid retrieval, but lawyers asked for answers, not just documents."],
        ],
        takeaway: 'Answers from private documents with sources → RAG.',
      },
      {
        q: 'An HR team wants to compute holiday entitlements from contract type and seniority, following fixed rules. Best approach?',
        options: [
          ["Encode the rules in code (an LLM can parse the free-text question)", "Correct: deterministic rules must be exact and auditable."],
          ["Give the rule document to an LLM and ask it to compute the days", "Risk of errors on exact rules; code is cheaper and verifiable."],
          ["Train a classifier on past entitlements computed by the HR team", "The rules are known: no need to learn them from data, with its errors."],
          ["Fine-tune an LLM on the HR policy and on past entitlement cases", "Expensive and still not guaranteed to be exact."],
        ],
        takeaway: 'Known deterministic rules → code, not a model.',
      },
      {
        q: 'You process 2 million product descriptions to extract 5 attributes. A large model is accurate but too expensive. Best option?',
        options: [
          ["Label a sample, train or prompt a small model, and test it", "Correct: a small specialised model can match the large one on a narrow task at a fraction of the cost (label with the large model and experts)."],
          ["Keep the large model but ask for much shorter outputs", "Output is already short for 5 attributes; the input dominates the cost."],
          ["Send 50 products per call without checking quality", "Batching can help cost, but quality must be measured."],
          ["Use the large model on a random 10 % of products", "Then 90 % of products get no attributes at all."],
        ],
        takeaway: 'High volume + narrow task → small model (prompted or fine-tuned), validated against the large one.',
      },
      {
        q: 'A client asks for "a ChatGPT for employees to write emails and summaries". What do you check first?',
        options: [
          ["Whether an enterprise product already covers it securely", "Correct: buy the commodity, build where the client data and processes create value."],
          ["Which open-source model to fine-tune on the client's emails", "Building may be unnecessary, and fine-tuning is rarely needed for writing help."],
          ["How to host a model on the client's own servers", "Premature: first check whether an existing product meets the need."],
          ["How to connect the assistant to every internal system", "Scope creep: the need is writing help, and an existing tool may cover it."],
        ],
        takeaway: 'Build vs buy: generic needs are often best served by existing products.',
      },
    ]),
    conceptQuiz('gen-cost-levers', 'Cost and latency levers', 'Making it cheaper and faster', 2, [
      {
        q: 'Your RAG assistant costs too much. Inputs are 8,000 tokens per request, outputs 300. What should you look at first?',
        options: [
          ["The input: fewer or shorter chunks, trimmed history, cached prefix", "Correct: input tokens dominate here."],
          ["The output: limit every answer to 100 tokens with a strict max_tokens", "Output is already small here; the gain would be limited."],
          ["The model: switch to a larger one that needs fewer retries", "Usually more expensive per token, and retries are not the issue."],
          ["The retrieval: increase k so the first answer is always right", "More chunks, more input tokens, higher cost."],
        ],
        takeaway: 'Find which side dominates the bill (input or output) before optimising.',
      },
      {
        q: 'Users complain the chatbot feels slow, although the full answer takes 6 seconds, which is acceptable for the business. Cheapest improvement?',
        options: [
          ["Stream the answer so the first words appear after a second", "Correct: perceived latency drops dramatically."],
          ["Switch to a larger model that writes better answers", "Probably slower."],
          ["Retrieve more documents so answers are more complete", "Adds time."],
          ["Show a spinner and an estimated waiting time while the answer is generated", "It helps a little, but users still wait 6 seconds for anything to read."],
        ],
        takeaway: 'Streaming improves perceived latency at no extra cost.',
      },
      {
        q: 'What is "model routing"?',
        options: [
          ["Easy requests go to a small cheap model, hard ones to a large model", "Correct: it cuts cost while keeping quality where it matters."],
          ["Requests are sent to the closest data centre to reduce latency", "That is network routing."],
          ["The same request goes to several models and the answers are merged", "That is ensembling, and it is expensive."],
          ["Requests are spread across providers to stay under rate limits", "That is load balancing; routing by difficulty is about cost and quality."],
        ],
        takeaway: 'Routing: match model size to request difficulty.',
      },
      {
        q: 'Why might a client prefer a self-hosted open-weights model over an API?',
        options: [
          ["Data must stay in-house, or stable high volume makes hosting cheaper", "Correct: control and economics at scale, at the cost of operating it."],
          ["Open-weights models are more accurate than API models on most tasks", "Not necessarily; test on the task."],
          ["APIs cannot legally be used with any company data in the European Union", "Many companies use APIs with appropriate agreements and EU hosting."],
          ["Self-hosting removes the need for engineering and monitoring", "It requires significant engineering and operations."],
        ],
        takeaway: 'API vs self-hosted: convenience and quality vs data control and cost at scale.',
      },
    ]),
    monthlyCost,
    latency,
    roi,
  ],
}
