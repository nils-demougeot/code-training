import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en, enText, usd } from '../helpers'

const md = String.raw
const tick = '`'
const block = (s: string) => `${tick.repeat(3)}text\n${s}\n${tick.repeat(3)}`

const fewShotCost: MathExercise = {
  id: 'gen-fewshot-cost',
  title: 'What do few-shot examples cost?',
  skill: 'Tokens × volume × price',
  level: 2,
  generate: (r) => {
    const k = r.pick([3, 5, 8])
    const tokensPerExample = r.pick([150, 200, 300])
    const callsPerDay = r.pick([2000, 5000, 10000, 20000])
    const price = r.pick([0.5, 1, 2.5, 3])
    const extra = k * tokensPerExample
    const monthly = (extra * callsPerDay * 30 * price) / 1e6
    return {
      params: { k, tokensPerExample, callsPerDay, price },
      statement: md`Your ticket classifier is more accurate when the prompt includes **${k} labelled examples** (few-shot). Each example is about **${tokensPerExample} tokens**. The app makes **${enText(callsPerDay)} calls per day**, and input tokens cost **${usd(price)} per million**.

1. How many extra input tokens per call do the examples add?
2. What is the extra cost per month (30 days), in dollars?`,
      fields: [field('Extra tokens per call', extra, 0), field('Extra cost per month ($)', monthly, 2, '$')],
      hint: md`Extra tokens per call $= k \times$ tokens per example. Monthly cost $= \dfrac{\text{tokens per call} \times \text{calls per day} \times 30}{10^6} \times \text{price per million}$.`,
      solution: md`$$${k} \times ${tokensPerExample} = ${en(extra)} \text{ tokens per call}$$

$$\frac{${en(extra)} \times ${en(callsPerDay)} \times 30}{10^6} \times ${en(price)} = ${en(monthly, 2)} \text{ dollars per month}$$

Few-shot examples are often worth it, but they are paid **on every call**. Options when the bill grows: fewer or shorter examples, a cheaper model, **prompt caching** (a repeated prefix billed at a discount by many providers), or fine-tuning a small model once you have enough labelled data.`,
    }
  },
}

export const promptingChapter: Chapter = {
  id: 'gen-prompting',
  title: 'Prompt engineering',
  emoji: '✍️',
  summary: 'Anatomy of a good prompt, few-shot, step-by-step reasoning, structured outputs, and how to iterate like an engineer.',
  lesson: md`## Why prompting matters

The prompt is the **specification** of your LLM feature. A vague prompt gives vague, inconsistent results; a precise prompt gives behaviour you can test. Prompt engineering is less about magic words and more about **writing a clear brief**, like you would for a smart new intern who knows nothing about the client.

## Anatomy of a good prompt

| Part | What to write | Example (ticket triage for an insurer) |
|---|---|---|
| **Role and goal** | who the model is, what for | "You triage customer emails for a car insurer." |
| **Task** | the exact job, step by step | "Classify the email and extract the policy number." |
| **Context** | facts it needs and does not know | the list of categories and their definitions |
| **Input, delimited** | the data, clearly separated | the email between ${code('<email>')} tags |
| **Constraints** | what to do and not do | "Use only the email. If the policy number is missing, use null." |
| **Output format** | exact structure | a JSON object with fixed keys and allowed values |
| **Examples** | 2 to 5 solved cases (few-shot) | one email per category, especially the tricky ones |

Many APIs separate a **system prompt** (stable rules, role, format) from **user messages** (the data of each request).

A weak prompt:

${block('Classify this email: {email}')}

A strong prompt:

${block(`You triage customer emails for a car insurer.
Categories: claim, billing, policy_change, complaint, other.
- claim: the customer reports an accident or damage
- complaint: the customer is unhappy with a past decision or service
...
Read the email between <email> tags and answer ONLY with JSON:
{"category": one of the categories, "policy_number": string or null, "urgent": true/false}
Mark urgent=true only if someone is injured or the car is undrivable.
<email>{email}</email>`)}

## Useful techniques

- **Zero-shot**: instructions only. Fine for simple, common tasks.
- **Few-shot**: add a few input → output examples. Best way to fix inconsistent labels or a particular style. Pick diverse and tricky examples; they cost tokens on every call.
- **Step-by-step reasoning**: for multi-step problems, ask the model to reason before answering (or use a reasoning model). Ask for the final answer in a separate, parseable field.
- **Decomposition (prompt chaining)**: split a big task into steps (extract → check → write), each with its own prompt. Easier to test and debug than one giant prompt.
- **Structured outputs**: ask for JSON with a schema, use the API's JSON / schema mode when available, and **validate** the result in code (and retry or fall back if invalid).
- **Grounding instructions**: "Answer only from the documents below. If the answer is not there, say you don't know." Essential against hallucinations.

## Iterate like an engineer

1. Write **test cases** first: 20–50 real inputs with the expected output, including edge cases.
2. Change **one thing at a time** in the prompt and re-run all the cases.
3. Track the score: a prompt change that fixes one case can break three others.
4. Version your prompts like code.

This is called **prompt evaluation**, and it is what separates a demo from a product (more in chapter 5).

## Common mistakes

- Asking for several things at once without structure.
- Not saying what to do when information is missing (the model will invent).
- Relying on "please be accurate": instructions do not remove hallucinations; grounding and checks do.
- Testing on 3 examples and declaring victory.

## In a client conversation

> "The prompt is the spec. We will build a small test set from your real emails, measure the accuracy of each version of the prompt, and only ship when it beats your current process."`,
  formulas: [
    { name: 'Prompt anatomy', tex: md`\text{role} + \text{task} + \text{context} + \text{delimited input} + \text{constraints} + \text{format} + \text{examples}` },
    { name: 'Cost of few-shot examples', tex: md`\text{extra cost} = \frac{k \times \text{tokens/example} \times \text{calls}}{10^6} \times \text{price per M}` },
  ],
  exercises: [
    conceptQuiz('gen-prompt-anatomy', 'Anatomy of a good prompt', 'Writing a clear brief', 1, [
      {
        q: 'Your summaries of client meetings come back in a different format every time. What should you add to the prompt first?',
        options: [
          ["An explicit output format (sections, length, style), with one example", "Correct: the model cannot guess a format you did not specify; an example makes it unambiguous."],
          ["\"Always be consistent with your previous summaries\" at the top", "The model does not see its previous summaries: each call starts fresh. Specify the format itself."],
          ["A lower temperature, so that the model stops improvising", "It may reduce variation a little, but without a specified format the model still has to guess one."],
          ["A detailed description of the company, the meeting and its attendees", "Useful context maybe, but it does not fix the format."],
        ],
        takeaway: 'Specify the output format explicitly (and show an example) when you need consistent structure.',
      },
      {
        q: 'Why put the customer email between tags like <email> … </email>?',
        options: [
          ["To separate the data from the instructions, so the model doesn't mix them up", "Correct: delimiters make clear what is input data, not instructions (and they help against prompt injection)."],
          ["Because models are trained mostly on web pages and understand HTML tags best", "Models read any text; tags are just a clear convention, and Markdown or quotes also work."],
          ["To let the API count the tokens of the email separately for billing", "The API bills all tokens the same way; tags only add a few tokens. The benefit is clarity."],
          ["Because the API rejects any prompt that mixes free text and data", "No API requires it; it is a good practice, not a constraint."],
        ],
        takeaway: 'Delimit input data clearly (tags, quotes, headings) to separate it from instructions.',
      },
      {
        q: 'The model sometimes invents a policy number when the email does not contain one. Best prompt fix?',
        options: [
          ["Say what to output when it is missing (e.g. null) and to use only the email", "Correct: give the model a legitimate way to say \"not found\"; otherwise it fills the gap."],
          ["Add \"Do not hallucinate and never invent a policy number\" to the prompt", "Helps a little at best; a concrete rule for the missing case (output null) works much better."],
          ["Add few-shot examples, each with an email and its correct policy number", "If every example has a number, the model learns that a number is always there: the problem gets worse. Include a 'missing' example."],
          ["Validate the number's format with a regex and retry the call until it matches", "An invented number can have a perfectly valid format; the retry does not stop the invention."],
        ],
        takeaway: 'Always define the behaviour for missing or ambiguous information.',
      },
      {
        q: 'What is "few-shot prompting"?',
        options: [
          ["Including a few solved examples (input → expected output) in the prompt", "Correct: the model imitates the pattern of the examples."],
          ["Calling the model a few times on the same input and keeping the best answer", "That is sampling several candidates (self-consistency), a different technique."],
          ["Fine-tuning the model on a few hundred labelled examples of the task", "Fine-tuning changes the weights; few-shot only changes the prompt."],
          ["Splitting a long question into a few short questions asked in sequence", "That is decomposition, or prompt chaining."],
        ],
        takeaway: 'Few-shot = examples in the prompt. No training, but they cost tokens on every call.',
      },
      {
        q: 'A system prompt is…',
        options: [
          ["The stable instructions (role, rules, format) sent with every request", "Correct: put the rules that never change in the system prompt, separate from the user messages."],
          ["The hidden prompt the model writes for itself before answering the user", "No: you write it. (Reasoning models do think before answering, but that is not the system prompt.)"],
          ["The first message of each conversation, written by the end user", "User messages are separate; the system prompt sets the frame for all of them."],
          ["The provider's own safety rules, which developers cannot see or change", "Providers have their own policies, but the system prompt is the part you write and control."],
        ],
        takeaway: 'System prompt = stable rules and role; user messages = per-request data.',
      },
    ]),
    conceptQuiz('gen-prompt-doctor', 'Prompt doctor', 'Diagnose and fix a prompt', 2, [
      {
        q: 'Your app parses the model answer with json.loads and crashes about 2 % of the time. Best fix?',
        options: [
          ["Use the API's JSON/schema mode, validate in code, and retry when invalid", "Correct: never trust free text to be valid JSON; constrain, validate and handle failures."],
          ["Ask in capital letters for VALID JSON ONLY, and show one example output", "Might reduce errors, will not remove them. Production code must handle invalid output."],
          ["Wrap json.loads in a try/except that returns an empty result whenever it fails", "It stops the crash, but 2 % of documents silently lose their data. Validate and retry instead."],
          ["Strip everything before the first { and after the last } before parsing", "A useful hack for extra text, but it does not fix truncated or malformed JSON."],
        ],
        takeaway: 'Structured output: constrain (schema mode), validate in code, retry or fall back.',
      },
      {
        q: 'The classifier hesitates between "complaint" and "claim" on the same kind of email. What helps most?',
        options: [
          ["Precise definitions of each category, plus examples of the borderline cases", "Correct: ambiguity comes from the spec; define the boundary and show examples."],
          ["A bigger model, which understands the fine nuances between categories better", "A bigger model still has to guess where your boundary is if you never defined it."],
          ["An instruction to think carefully and to double-check the category", "Without a definition of the boundary, careful does not help."],
          ["Merge \"complaint\" and \"claim\" into one category so it stops hesitating", "That changes the business requirement instead of fixing the prompt."],
        ],
        takeaway: 'Inconsistent labels → define categories precisely and add examples of borderline cases.',
      },
      {
        q: 'The model gets multi-step calculations about insurance premiums wrong. What to try first?',
        options: [
          ["Ask it to reason step by step, and let it call code for the arithmetic", "Correct: reasoning helps with multi-step logic; tools (or a reasoning model plus code) fix arithmetic."],
          ["Add \"You are an expert actuary with 20 years of experience\" to the prompt", "Role prompts help with tone and focus, not with arithmetic accuracy."],
          ["Ask for the final number only, so the model is not distracted by text", "The opposite: removing the intermediate steps makes multi-step calculations less reliable."],
          ["Shorten the prompt so that the model focuses only on the formula", "Shorter does not make arithmetic more reliable."],
        ],
        takeaway: 'Multi-step problems: step-by-step reasoning; exact numbers: tools.',
      },
      {
        q: 'Your 3-page prompt has 25 rules and the model ignores some of them. Best approach?',
        options: [
          ["Structure it, remove what isn't needed, and split it into chained prompts", "Correct: long unstructured prompts dilute instructions; decomposition makes each step testable."],
          ["Repeat the most important rules several times and write them in bold", "Makes the prompt longer and still unclear; emphasis does not fix overload."],
          ["Move all 25 rules to the end of the prompt, closest to the question", "Placement can matter a little, but location alone does not solve the overload."],
          ["Switch to a model with a larger context window so the 25 rules fit more easily", "The prompt already fits; the problem is too many rules at once, not space."],
        ],
        takeaway: 'Too many instructions → structure, trim, and decompose into a chain of simpler prompts.',
      },
      {
        q: 'You changed the prompt and the 3 examples you tried look better. What should you do before shipping?',
        options: [
          ["Re-run the full test set and compare scores with the previous version", "Correct: a fix for 3 cases can break others; measure on the whole set."],
          ["Try 3 more examples, and ship it if those look better as well", "Six examples are still anecdotes; a fix can break cases you did not try."],
          ["Ask the model to compare the old and new prompts and pick the best", "The model cannot evaluate its own prompt without test cases."],
          ["Ship it to 10 % of users first, and switch back if anyone complains", "Users rarely report subtle errors; silence does not mean correctness."],
        ],
        takeaway: 'Treat prompts like code: a test set, one change at a time, regression checks.',
      },
      {
        q: 'Answers to factual questions about the client policies are sometimes made up. Which instruction helps most (together with providing the policies)?',
        options: [
          ["\"Answer only from the documents. If the answer isn't there, say so.\"", "Correct: grounding plus an explicit way out."],
          ["\"Use your general knowledge of insurance when the documents are unclear.\"", "This invites the model to fill gaps with generic, possibly wrong knowledge."],
          ["\"Be very careful and accurate: our customers rely on your answers.\"", "Pressure without a rule does not stop invention."],
          ["\"Never say you don't know: always give the customer a useful answer.\"", "This forces the model to invent when it lacks information."],
        ],
        takeaway: 'Grounding instruction + explicit "I don\'t know" path, with the source documents in the context.',
      },
    ]),
    fewShotCost,
  ],
}

function code(s: string) {
  return tick + s + tick
}
