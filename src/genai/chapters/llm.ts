import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en, enText } from '../helpers'

const md = String.raw
const code = (s: string) => '`' + s + '`'

const tokens: MathExercise = {
  id: 'gen-tokens',
  title: 'Will it fit in the context window?',
  skill: 'Tokens ≈ words / 0.75',
  level: 1,
  generate: (r) => {
    const words = r.pick([3000, 4500, 6000, 7500, 9000])
    const window = r.pick([32000, 64000, 128000])
    const reserved = r.pick([2000, 4000, 8000])
    const perDoc = words / 0.75
    return {
      params: { words, window, reserved },
      statement: md`A client wants to ask an LLM questions about its supplier contracts. Each contract is about **${enText(words)} words** long. The model has a context window of **${enText(window)} tokens**, and you keep **${enText(reserved)} tokens** for the instructions, the question and the answer.

Use the rule of thumb **1 token ≈ 0.75 English words**.

1. About how many tokens is one contract?
2. How many **whole** contracts can you put in a single prompt at most?`,
      fields: [field('Tokens per contract', perDoc, 0), field('Contracts per prompt', Math.floor((window - reserved) / perDoc), 0)],
      hint: md`Tokens $\approx \dfrac{\text{words}}{0.75}$. The space left for documents is the window minus what you reserve; divide it by the size of one contract and round **down**.`,
      solution: md`$$\text{tokens per contract} \approx \frac{${en(words)}}{0.75} = ${en(perDoc, 0)}$$

$$\left\lfloor \frac{${en(window)} - ${en(reserved)}}{${en(perDoc, 0)}} \right\rfloor = \left\lfloor ${en((window - reserved) / perDoc, 2)} \right\rfloor = ${Math.floor((window - reserved) / perDoc)}$$

A context window counts **everything**: instructions, documents, chat history **and** the generated answer. When the documents do not fit (thousands of contracts), you stop pasting them and **retrieve** only the relevant passages: that is RAG (chapter 4). Long prompts are also slower and more expensive, since you pay per token.`,
    }
  },
}

const temperature: MathExercise = {
  id: 'gen-temperature',
  title: 'Temperature in action',
  skill: 'Softmax with temperature',
  level: 3,
  generate: (r) => {
    const logits = r.pick([[2, 1, 0], [3, 1, 0], [2, 2, 0], [4, 2, 1]])
    const temp = r.pick([0.5, 2])
    const soft = (t: number) => {
      const e = logits.map((z) => Math.exp(z / t))
      const s = e.reduce((a, b) => a + b, 0)
      return e.map((x) => x / s)
    }
    const p1 = soft(1)
    const pt = soft(temp)
    const words = ['"Paris"', '"Lyon"', '"pizza"']
    return {
      params: { logits, temp },
      statement: md`To continue *"The capital of France is …"*, a model gives these scores (**logits**) to three candidate tokens:

| token | ${words.join(' | ')} |
|---|---|---|---|
| logit | ${logits.join(' | ')} |

Probabilities are $p_i = \dfrac{e^{z_i / T}}{\sum_j e^{z_j / T}}$ where $T$ is the **temperature**.

1. Probability of ${words[0]} at $T = 1$?
2. Probability of ${words[0]} at $T = ${en(temp)}$?

You can type an expression such as e^2/(e^2+e+1).`,
      fields: [field('$p(\\text{Paris})$ at $T = 1$', p1[0], 3), field(`$p(\\text{Paris})$ at $T = ${en(temp)}$`, pt[0], 3)],
      hint: md`Divide every logit by $T$ first, then apply the softmax: exponentiate and normalise so that the probabilities sum to 1.`,
      solution: md`At $T = 1$: $p = \dfrac{e^{${logits[0]}}}{${logits.map((z) => `e^{${z}}`).join(' + ')}} \approx ${en(p1[0], 4)}$.

At $T = ${en(temp)}$ the logits become $(${logits.map((z) => en(z / temp, 2)).join(',\\ ')})$, so $p \approx ${en(pt[0], 4)}$.

${temp < 1 ? md`A **low temperature sharpens** the distribution: the most likely token gets even more likely. Use $T$ close to 0 for extraction, classification or anything that must be consistent.` : md`A **high temperature flattens** the distribution: unlikely tokens (like "pizza") get a real chance. Useful for brainstorming or creative writing, risky for facts.`} The model itself does not change: temperature only changes **how we sample** from its probabilities.`,
    }
  },
}

export const llmChapter: Chapter = {
  id: 'gen-llm',
  title: 'How LLMs work',
  emoji: '🧠',
  summary: 'Tokens, next-token prediction, context window, temperature, training stages, hallucinations.',
  lesson: md`## The one-sentence version

A **large language model (LLM)** is a neural network trained to **predict the next token** of a text. Everything else (answering questions, writing code, summarising) emerges from doing this extremely well, one token at a time.

## Tokens

Models do not read words or letters: they read **tokens**, pieces of words from a fixed vocabulary (often 50k to 200k entries).

- "unbelievable" might be split into ${code('un')} + ${code('believ')} + ${code('able')}.
- Rule of thumb in English: **1 token ≈ 0.75 words ≈ 4 characters**. Other languages and code usually need more tokens per word.
- Why you care: **price, speed and limits are all counted in tokens**.

## Generating text

At each step the model outputs a **score (logit)** for every token in the vocabulary. A **softmax** turns the scores into probabilities, one token is picked, appended to the text, and the loop starts again. This is called **autoregressive** generation.

How the token is picked is a choice:

| Setting | Effect | Typical use |
|---|---|---|
| **Temperature** $T$ | divides logits by $T$: low $T$ = sharper, high $T$ = flatter | $T \approx 0$ for extraction, $T \approx 0.7$–$1$ for creative text |
| **Top-p** (nucleus) | sample only among the most likely tokens whose probabilities add up to $p$ | cuts off the absurd long tail |
| **Max tokens** | hard limit on the answer length | controls cost and latency |

Even at temperature 0, outputs are not always perfectly reproducible across runs or model versions: do not build a system that relies on it.

## The context window

The model only "sees" its **context window**: the system prompt, the conversation, any documents you paste **and** the answer being generated. Typical windows range from about 8k to over 1M tokens. Anything outside the window does not exist for the model: an LLM has **no memory between calls** unless you send the history again.

## How a chat model is trained

1. **Pre-training**: next-token prediction on a huge amount of text (web, books, code). The model learns language, facts and reasoning patterns. This is the expensive part.
2. **Instruction tuning (SFT)**: training on examples of instructions and good answers, so that it behaves like an assistant instead of just continuing text.
3. **Preference tuning (RLHF, DPO…)**: humans (or models) compare answers; the model is pushed toward the preferred ones: more helpful, more honest, safer.

Its knowledge stops at a **training cutoff date**, and it knows nothing about your client's private data unless you give it in the prompt.

## Why LLMs hallucinate

An LLM generates **plausible** text, not verified text. When it does not know, the most plausible continuation can be a confident, wrong answer: a **hallucination** (an invented figure, a fake reference, a wrong policy). It is not a bug that will disappear with a better prompt; it is built into how the model works. You reduce it by **grounding** the model in sources (RAG), asking it to cite them and to say "I don't know", and by **evaluating** outputs (chapters 4 and 5).

## What they are good and bad at

| Good at | Weak at |
|---|---|
| Language tasks: summarising, rewriting, translating, drafting | Exact arithmetic and counting (give them a calculator tool) |
| Extracting structured fields from messy text | Facts after the cutoff, private data, niche facts |
| Classifying text with few or no labelled examples | Guaranteeing 100 % consistency or correctness |
| Writing and explaining code | Tabular prediction (churn, prices): classic ML is usually better, cheaper and easier to explain |

## In a client conversation

> "An LLM is a very good autocomplete trained on most of the public internet. It is excellent with language, but it does not *know* your data and it can be confidently wrong, so we connect it to your documents and we measure its error rate before anyone relies on it."`,
  formulas: [
    { name: 'Tokens (English rule of thumb)', tex: md`\text{tokens} \approx \frac{\text{words}}{0.75} \approx \frac{\text{characters}}{4}` },
    { name: 'Softmax with temperature', tex: md`p_i = \frac{e^{z_i / T}}{\sum_j e^{z_j / T}}` },
    { name: 'Context budget', tex: md`\text{system} + \text{history} + \text{documents} + \text{answer} \le \text{context window}` },
  ],
  exercises: [
    conceptQuiz('gen-llm-basics', 'Tokens, context and generation', 'Core vocabulary', 1, [
      {
        q: 'What does an LLM fundamentally do when it generates an answer?',
        options: [
          ["It predicts a probability for each possible next token, picks one, and repeats", "Correct: generation is a loop of next-token prediction, one token at a time."],
          ["It looks up the most relevant facts stored in its database, then phrases them as text", "No: there is no fact database inside. Knowledge is stored implicitly in the weights, which is why it can be wrong."],
          ["It plans the whole answer first, writes it, then checks it for errors before replying", "No: tokens are produced one after the other; nothing is planned or checked unless you add a step for it."],
          ["It finds the most similar passage it saw during training and adapts it to the question", "No: it generalises from patterns; it can memorise some text but it is not a retrieval system."],
        ],
        takeaway: 'An LLM is a next-token predictor. Answers are generated token by token, by sampling from a probability distribution.',
      },
      {
        q: 'A user chats with your assistant for an hour. The model suddenly "forgets" what was said at the beginning. Most likely cause?',
        options: [
          ["The chat no longer fits in the context window, so the oldest messages were dropped", "Correct: the model only sees what is in the window; long chats are truncated or summarised."],
          ["The model's attention degrades after an hour of use and needs to be reset by a new session", "No: each call is independent; there is no state that wears out over time."],
          ["The temperature was too high, so the model drifted away from the early messages", "Temperature changes how random the next token is, not what the model can see."],
          ["It learned new information during the chat and overwrote what it had learned before", "No: the weights do not change during a conversation; nothing is learned."],
        ],
        takeaway: 'An LLM has no memory: each call only sees its context window. Chat apps resend (or summarise) the history every time.',
      },
      {
        q: 'Roughly how many tokens is a 1,500-word English report?',
        options: [
          ["About 2,000", "Correct: one token is about 0.75 words, so 1,500 / 0.75 = 2,000 tokens."],
          ["About 1,125", "That is 1,500 × 0.75: the rule goes the other way (one token is about 0.75 words, so there are more tokens than words)."],
          ["About 6,000", "That would be about 4 tokens per word; it is roughly 4 characters per token."],
          ["Exactly 1,500", "Tokens are sub-word pieces: frequent words are one token, rarer ones several."],
        ],
        takeaway: 'English: 1 token ≈ 0.75 words ≈ 4 characters. Costs and limits are counted in tokens.',
      },
      {
        q: 'You extract invoice amounts into JSON and need the same output every time. Which setting?',
        options: [
          ["Temperature close to 0", "Correct: low temperature makes the most likely token win almost always: consistent, less creative."],
          ["Temperature around 1.5", "High temperature adds randomness: good for brainstorming, bad for extraction."],
          ["A very large max_tokens", "Max tokens only limits the length; it does not make answers consistent."],
          ["Top-p = 1, temperature = 1", "These are typical defaults for open-ended chat, not for deterministic extraction."],
        ],
        takeaway: 'Low temperature for extraction, classification and factual tasks; higher for creative tasks.',
      },
      {
        q: 'What is a "context window" of 128k tokens?',
        options: [
          ["The most tokens it can take into account in one call, prompt and answer included", "Correct: everything (instructions, documents, history, answer) must fit."],
          ["The number of tokens of text the model saw during its training", "Training data is trillions of tokens; that is unrelated to the window."],
          ["The number of different tokens in its vocabulary, i.e. all the words and pieces it knows", "The vocabulary is the list of possible tokens (often 50k–200k), a different thing."],
          ["The maximum length of the answer only, the prompt being unlimited", "No: the prompt counts too. Long documents and histories eat the same budget as the answer."],
        ],
        takeaway: 'Context window = how much text one call can see (input + output).',
      },
    ]),
    conceptQuiz('gen-llm-training', 'Training and limits', 'Pre-training, tuning, hallucinations', 2, [
      {
        q: 'Which training stage turns a raw text predictor into a helpful assistant that follows instructions?',
        options: [
          ["Instruction tuning on instruction/answer pairs, then preference tuning", "Correct: pre-training gives knowledge; instruction and preference tuning give the assistant behaviour."],
          ["More pre-training on a larger and cleaner set of web pages, books and code", "More pre-training improves knowledge, but a raw model just continues text; it does not reliably follow instructions."],
          ["A larger context window, so it can read the whole instruction", "A bigger window lets it read more; it does not change behaviour."],
          ["A carefully written system prompt applied during pre-training", "System prompts are used at question time, not in pre-training; behaviour comes from tuning on examples."],
        ],
        takeaway: 'Pre-training → instruction tuning (SFT) → preference tuning (RLHF / DPO).',
      },
      {
        q: 'Why do LLMs hallucinate?',
        options: [
          ["It writes the most plausible continuation, which is not always true, and checks nothing", "Correct: plausibility is not truth. Grounding in sources and evaluation reduce the problem."],
          ["The temperature is above 0, so it sometimes picks unlikely and wrong tokens", "Hallucinations also happen at temperature 0: the most likely answer can be wrong."],
          ["Its training data contained false information, which it then repeats faithfully", "Bad data plays a small part, but models also invent things that appear nowhere in their data."],
          ["Long prompts overload its memory, so it fills the gaps with random words", "Long contexts can make it miss information, but hallucinations happen on short prompts too, and what it writes is plausible, not random."],
        ],
        takeaway: 'Hallucination = plausible but false output. Mitigate with grounding (RAG), citations, "say I don\'t know", and evaluation.',
      },
      {
        q: 'A client asks the model about a regulation published last month. The answer is outdated. Best fix?',
        options: [
          ["Put the new text in the prompt (or retrieve it) and ask for an answer based on it", "Correct: the model knowledge stops at its training cutoff; give it the source."],
          ["Ask the model explicitly to use its most recent knowledge of the regulation", "It cannot know what happened after its cutoff, however you ask."],
          ["Fine-tune the model on the new regulation so that it learns the update", "Slow and unreliable for facts, and there will be another update next month; retrieval is the standard answer."],
          ["Switch to the latest model version, which was trained on much more recent data", "Newer cutoffs help a bit, but last month's text is still unlikely to be in it."],
        ],
        takeaway: 'Knowledge cutoff: anything recent or private must be given to the model (prompt or RAG).',
      },
      {
        q: 'A bank wants to predict which customers will churn from 40 columns of account data. LLM or classic ML?',
        options: [
          ["Classic ML (e.g. gradient boosting) on the tabular data", "Correct: for tabular prediction, classic ML is usually more accurate, cheaper, faster and easier to explain and monitor."],
          ["An LLM, prompted with each customer's 40 columns as text", "Powerful at language, not at learning patterns from 40 numeric columns and thousands of rows; and costly per customer."],
          ["An LLM fine-tuned on the table rows converted to sentences", "Possible in research, but rarely better than gradient boosting and much more expensive."],
          ["An LLM agent that queries the database and decides who churns", "An agent adds cost and unpredictability to a well-defined prediction task."],
        ],
        takeaway: 'GenAI is for language and documents. For tabular prediction, start with classic ML.',
      },
      {
        q: 'Which task is an LLM most likely to get wrong without a tool?',
        options: [
          ["Summing 250 invoice amounts precisely", "Correct: exact arithmetic over many numbers is unreliable; let the model call a calculator or write code."],
          ["Rewriting a complaint email more politely", "A typical strength of LLMs."],
          ["Extracting the supplier name from an invoice", "Extraction from text is a strength, especially with a clear format."],
          ["Sorting a support ticket into 5 categories", "Zero-shot or few-shot classification usually works well."],
        ],
        takeaway: 'LLMs are weak at exact computation and counting: give them tools (calculator, code, database).',
      },
    ]),
    tokens,
    temperature,
  ],
}
