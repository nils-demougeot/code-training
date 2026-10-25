import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en } from '../helpers'

const md = String.raw

const retrievalMetrics: MathExercise = {
  id: 'gen-recall-mrr',
  title: 'Is the retriever finding the right passage?',
  skill: 'Recall@k and MRR',
  level: 2,
  generate: (r) => {
    // Rank of the first relevant chunk for each test question (0 = not retrieved in the top 10).
    const ranks = Array.from({ length: 5 }, () => r.pick([1, 1, 1, 2, 3, 4, 6, 0]))
    const k = r.pick([3, 5])
    const recall = ranks.filter((x) => x > 0 && x <= k).length / ranks.length
    const mrr = ranks.reduce((s, x) => s + (x > 0 ? 1 / x : 0), 0) / ranks.length
    return {
      params: { ranks, k },
      statement: md`You test the retriever of a RAG assistant on 5 questions whose correct passage you know. For each question, the position of the correct passage in the results is:

| question | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| rank of the correct passage | ${ranks.map((x) => (x ? x : 'not found')).join(' | ')} |

1. Compute **recall@${k}**: the share of questions whose correct passage is in the top ${k}.
2. Compute the **MRR** (mean reciprocal rank): the average of $1/\text{rank}$, counting 0 when the passage is not found.`,
      fields: [field(`Recall@${k}`, recall, 2), field('MRR', mrr, 3)],
      hint: md`Recall@k $= \dfrac{\#\{\text{questions with rank} \le k\}}{\#\text{questions}}$. MRR $= \dfrac{1}{n}\sum_i \dfrac{1}{\text{rank}_i}$.`,
      solution: md`Ranks within the top ${k}: ${ranks.filter((x) => x > 0 && x <= k).length} out of 5, so recall@${k} $= ${en(recall, 2)}$.

$$\text{MRR} = \frac{${ranks.map((x) => (x ? `\\frac{1}{${x}}` : '0')).join(' + ')}}{5} \approx ${en(mrr, 4)}$$

**Recall@k** answers "does the right passage reach the LLM at all?" (the LLM only sees the top k). **MRR** rewards putting it **first**. If recall@k is low, no prompt can save the answer: fix retrieval first (chunking, hybrid search, reranking, query rewriting).`,
    }
  },
}

const precisionAtK: MathExercise = {
  id: 'gen-precision-k',
  title: 'Precision and recall of one search',
  skill: 'Precision@k, recall@k',
  level: 1,
  generate: (r) => {
    const flags = Array.from({ length: 5 }, () => r.pick([0, 1, 1]))
    if (!flags.some(Boolean)) flags[r.int(0, 4)] = 1
    const relevantTotal = flags.reduce((a, b) => a + b, 0) + r.int(0, 3)
    const hits = flags.reduce((a, b) => a + b, 0)
    return {
      params: { flags, relevantTotal },
      statement: md`For the question *"What is the notice period for a fixed-term contract?"*, the retriever returns 5 chunks. An expert marks them as relevant (✓) or not (✗):

| position | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| relevant? | ${flags.map((f) => (f ? '✓' : '✗')).join(' | ')} |

In the whole knowledge base there are **${relevantTotal}** relevant chunks for this question.

1. Precision@5?
2. Recall@5?`,
      fields: [field('Precision@5', hits / 5, 2), field('Recall@5', relevantTotal ? hits / relevantTotal : 0, 2)],
      hint: md`Precision@k $= \dfrac{\text{relevant retrieved}}{k}$: how clean are the results? Recall@k $= \dfrac{\text{relevant retrieved}}{\text{all relevant}}$: how complete?`,
      solution: md`${hits} relevant chunks among the 5 retrieved: precision@5 $= ${hits}/5 = ${en(hits / 5, 2)}$, recall@5 $= ${hits}/${relevantTotal} = ${en(relevantTotal ? hits / relevantTotal : 0, 2)}$.

Low **precision** fills the prompt with noise (cost, distraction, contradictions). Low **recall** means missing information, so the answer is incomplete or invented. A **reranker** (a model that rescores the top 20–50 candidates) is a common way to improve precision at the top.`,
    }
  },
}

export const ragChapter: Chapter = {
  id: 'gen-rag',
  title: 'Retrieval-Augmented Generation (RAG)',
  emoji: '📚',
  summary: 'Grounding an LLM in a client’s documents: the pipeline, design choices, failure modes, how to evaluate it, and RAG vs fine-tuning.',
  lesson: md`## Why RAG

The client wants an assistant that answers from **its own documents**: HR policies, product manuals, contracts, procedures. The LLM does not know them (they are private and change often), and they do not fit in one prompt. **RAG** solves this: **retrieve** the relevant passages, then **generate** an answer from them.

It is the most common enterprise GenAI pattern because it:

- uses **private and up-to-date** knowledge without retraining (update a document, re-index it, done);
- lets the answer **cite its sources**, so users can check;
- reduces hallucinations (it does not remove them);
- can respect **access rights** by filtering what each user can retrieve.

## The pipeline

**Offline (indexing)**
1. Load and parse documents (PDF, Word, web pages; tables and scans are the hard part).
2. Clean and **chunk** them, keeping metadata (title, section, date, permissions).
3. **Embed** each chunk and store it in an index (vector and/or keyword).

**Online (each question)**
1. (Optional) **Rewrite** the question (e.g. resolve "and for part-timers?" using the chat history).
2. **Retrieve** the top-k candidate chunks (hybrid search).
3. (Optional) **Rerank** them with a more precise model and keep the best few.
4. **Build the prompt**: instructions + retrieved chunks with their sources + question.
5. **Generate** the answer with citations, or "I don't know" if the sources do not contain it.

## Design choices that matter

| Choice | Effect |
|---|---|
| Chunk size and overlap | precision vs context (chapter 3) |
| k (chunks sent to the LLM) | more recall but more noise, cost and latency |
| Hybrid search, reranking | usually the biggest quality gains |
| Metadata filters | freshness ("current version only"), permissions, country |
| Prompt | "answer only from the sources, cite them, say if unsure" |

## How RAG fails (and how to tell)

| Symptom | Likely cause | Fix |
|---|---|---|
| Right answer exists, but the bot says it does not know | **retrieval miss** (recall) | better chunking, hybrid search, query rewriting |
| Answer mixes old and new rules | outdated documents indexed | metadata filters, document lifecycle |
| Answer contradicts the cited source | **generation** not grounded | stricter prompt, smaller k, check faithfulness |
| Fine on simple questions, bad on "compare A and B" | one retrieval cannot cover both | decompose the question, multiple retrievals |
| Tables and figures answered wrongly | parsing lost the structure | better parsing, table-aware chunking |

The key habit: **evaluate retrieval and generation separately**. If the right passage was not retrieved, the LLM never had a chance.

## Evaluating a RAG system

- **Retrieval**: build a set of questions with their known correct passages; measure **recall@k** (is it in the top k?) and **MRR** (is it near the top?).
- **Generation**: **faithfulness / groundedness** (is every claim supported by the retrieved passages?), **answer relevance** (does it answer the question?), correctness against a reference answer. Often scored by experts on a sample, or by an LLM judge calibrated against experts.

## RAG or fine-tuning?

| Need | Use |
|---|---|
| Answer from specific, changing documents; cite sources | **RAG** |
| A specific style, format or behaviour on a narrow task | prompting, then **fine-tuning** if needed |
| Both | both (fine-tuning does not reliably add up-to-date facts) |

## In a client conversation

> "Your assistant will answer from your documents only, and every answer will cite the paragraph it comes from. We will measure two things separately: does it find the right paragraph, and does it answer faithfully from it."`,
  formulas: [
    { name: 'Recall@k (over questions)', tex: md`\frac{\#\{\text{questions with the right passage in the top } k\}}{\#\text{questions}}` },
    { name: 'Mean reciprocal rank', tex: md`\text{MRR} = \frac{1}{n}\sum_i \frac{1}{\text{rank}_i}` },
    { name: 'Precision@k', tex: md`\frac{\text{relevant among the top } k}{k}` },
  ],
  exercises: [
    conceptQuiz('gen-rag-design', 'RAG building blocks', 'Pipeline and design choices', 1, [
      {
        q: 'What is the main reason enterprises use RAG rather than asking the LLM directly?',
        options: [
          ['To answer from private, up-to-date documents and cite the sources', 'Correct: RAG brings the client knowledge into the prompt at question time.'],
          ['To make the model faster', 'RAG adds a retrieval step; it is not about speed.'],
          ['To train the model on the documents', 'RAG does not change the model weights.'],
          ['To avoid paying for tokens', 'Retrieved chunks add tokens to every prompt.'],
        ],
        takeaway: 'RAG = retrieve relevant passages, then generate from them, with citations.',
      },
      {
        q: 'In which order does a RAG system process a user question?',
        options: [
          ['Embed / search the question → retrieve top-k chunks → (rerank) → put them in the prompt → generate', 'Correct.'],
          ['Generate an answer → search documents to check it → return the answer', 'That is a verification pattern, not the standard RAG flow.'],
          ['Fine-tune on the documents → generate', 'No training at question time in RAG.'],
          ['Chunk the question → embed the answer → retrieve', 'The question is not chunked, and the answer does not exist yet.'],
        ],
        takeaway: 'Question → retrieve → (rerank) → prompt with sources → answer with citations.',
      },
      {
        q: 'What does a reranker do?',
        options: [
          ['Rescores the top candidates from the first search with a more precise (slower) model, to put the best ones first', 'Correct: cheap first-stage retrieval for recall, precise reranking for precision.'],
          ['Sorts documents by date', 'That is a metadata sort, not reranking.'],
          ['Rewrites the answer', 'Rerankers score passages, they do not write.'],
          ['Removes duplicate documents from the index', 'That is deduplication at indexing time.'],
        ],
        takeaway: 'Two-stage retrieval: fast search for many candidates, then a reranker for the top few.',
      },
      {
        q: 'An employee in France gets the answer from the US HR policy. Best fix?',
        options: [
          ['Store country (and access rights) as metadata and filter retrieval on the user\'s country', 'Correct: metadata filters enforce context and permissions before generation.'],
          ['Add "answer for France" to the prompt', 'The prompt cannot fix wrong chunks being retrieved, and the US chunk may still dominate.'],
          ['Increase k so both policies are retrieved', 'More conflicting context makes things worse.'],
          ['Fine-tune the model on the French policy', 'Expensive and does not prevent retrieving the US policy.'],
        ],
        takeaway: 'Use metadata filters for country, version, permissions: retrieval must respect context.',
      },
      {
        q: 'When is fine-tuning a better fit than RAG?',
        options: [
          ['When you need a specific behaviour or output style on a narrow, repetitive task, not new facts', 'Correct: fine-tuning shapes behaviour; RAG supplies knowledge.'],
          ['When the documents change every week', 'Then RAG is better: re-index instead of retraining.'],
          ['When users need citations', 'RAG gives citations naturally.'],
          ['When you have very few examples', 'Fine-tuning needs a good set of examples; with few, prompt instead.'],
        ],
        takeaway: 'Knowledge → RAG. Behaviour/format → prompting, then fine-tuning if needed.',
      },
    ]),
    conceptQuiz('gen-rag-debug', 'RAG doctor', 'Diagnose failures', 3, [
      {
        q: 'The answer exists in the documentation, but the assistant says "I could not find this information". You check: the right passage is ranked 14th and k = 5. The problem is…',
        options: [
          ['Retrieval (recall): the passage never reached the LLM', 'Correct: improve retrieval (hybrid search, chunking, query rewriting, reranking) or adjust k.'],
          ['The LLM is not powerful enough', 'The LLM never saw the passage; a bigger model will not help.'],
          ['The temperature', 'Sampling cannot recover a passage that is not in the prompt.'],
          ['The prompt asks for citations', 'Citations are not the cause.'],
        ],
        takeaway: 'Always check retrieval first: if the passage is not in the top k, the LLM cannot use it.',
      },
      {
        q: 'The right passage is retrieved first, but the answer adds a condition that is not in the passage. The problem is…',
        options: [
          ['Generation is not faithful to the sources (a hallucination despite good retrieval)', 'Correct: tighten the instructions, ask for quotes or citations per claim, and measure faithfulness.'],
          ['Recall@k is too low', 'Retrieval worked here.'],
          ['The chunk size is too large', 'Possible contributor, but the observed failure is unfaithful generation.'],
          ['The embedding model', 'Retrieval worked; embeddings are not the issue.'],
        ],
        takeaway: 'Good retrieval + wrong answer = faithfulness problem in generation.',
      },
      {
        q: 'Users ask follow-up questions like "and for part-time staff?". Retrieval returns random passages. Best fix?',
        options: [
          ['Rewrite the follow-up into a standalone question using the chat history before retrieving', 'Correct: "and for part-time staff?" alone has no topic; query rewriting adds it.'],
          ['Increase k to 50', 'More noise, still no topic.'],
          ['Disable the chat history', 'Then follow-ups lose their meaning entirely.'],
          ['Use a bigger LLM for generation', 'The problem happens before generation.'],
        ],
        takeaway: 'In conversations, rewrite follow-ups into standalone queries before retrieval.',
      },
      {
        q: 'Retrieval returns 10 chunks; 7 are off-topic and the answer mixes them up. What to try?',
        options: [
          ['Add a reranker and keep only the best 3–4 chunks', 'Correct: improve precision at the top and send less noise to the LLM.'],
          ['Send all 50 candidates instead', 'Even more noise.'],
          ['Remove the instruction to cite sources', 'Citations help users spot the problem; removing them hides it.'],
          ['Raise the temperature', 'Unrelated.'],
        ],
        takeaway: 'Low precision → rerank and send fewer, better chunks.',
      },
      {
        q: 'Questions about numbers in tables (prices by plan) are often answered wrongly, text questions are fine. Most likely cause?',
        options: [
          ['Document parsing/chunking destroyed the table structure', 'Correct: tables flattened into text lose which number belongs to which row and column.'],
          ['The embedding model does not handle numbers', 'Partly, but the main issue is usually parsing.'],
          ['The users ask bad questions', 'The same questions work on text; the tables are the problem.'],
          ['The context window is too small', 'The answers are wrong, not cut off.'],
        ],
        takeaway: 'Parsing quality (tables, scans, layouts) is often the hidden bottleneck of RAG.',
      },
    ]),
    retrievalMetrics,
    precisionAtK,
  ],
}
