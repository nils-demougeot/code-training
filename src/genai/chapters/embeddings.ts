import { field, type Chapter, type MathExercise } from '../../maths/core'
import { conceptQuiz, en, enText } from '../helpers'

const md = String.raw
const vec = (v: number[]) => `(${v.join(',\\ ')})`

const cosine: MathExercise = {
  id: 'gen-cosine',
  title: 'Which document is closest?',
  skill: 'Cosine similarity',
  level: 2,
  generate: (r) => {
    const q = r.pick([[1, 2, 2], [2, 1, 2], [2, 2, 1], [1, 0, 1]])
    const d1 = r.pick([[2, 4, 4], [1, 2, 0], [0, 3, 4], [2, 1, 2]])
    const d2 = r.pick([[4, 0, 3], [1, 1, 1], [0, 0, 5], [3, 4, 0]])
    const cos = (a: number[], b: number[]) =>
      a.reduce((s, x, i) => s + x * b[i], 0) / (Math.hypot(...a) * Math.hypot(...b))
    return {
      params: { q, d1, d2 },
      statement: md`A (tiny) embedding model maps the user question and two help-centre articles to 3-dimensional vectors:

- question $q = ${vec(q)}$
- article A $a = ${vec(d1)}$
- article B $b = ${vec(d2)}$

Compute the **cosine similarity** of the question with each article. The search engine will show the article with the highest similarity first.`,
      fields: [field('$\\cos(q, a)$', cos(q, d1), 3), field('$\\cos(q, b)$', cos(q, d2), 3)],
      hint: md`$\cos(u, v) = \dfrac{u \cdot v}{\|u\|\,\|v\|}$ with $u \cdot v = \sum_i u_i v_i$ and $\|u\| = \sqrt{\sum_i u_i^2}$.`,
      solution: md`$$\cos(q, a) = \frac{${q.map((x, i) => `${x} \\times ${d1[i]}`).join(' + ')}}{${en(Math.hypot(...q), 3)} \times ${en(Math.hypot(...d1), 3)}} \approx ${en(cos(q, d1), 4)}$$

$$\cos(q, b) = \frac{${q.map((x, i) => `${x} \\times ${d2[i]}`).join(' + ')}}{${en(Math.hypot(...q), 3)} \times ${en(Math.hypot(...d2), 3)}} \approx ${en(cos(q, d2), 4)}$$

${cos(q, d1) === cos(q, d2) ? 'Both articles are equally close.' : `Article ${cos(q, d1) > cos(q, d2) ? 'A' : 'B'} is closer in meaning and would be ranked first.`} Real embeddings have hundreds or thousands of dimensions, but the computation is exactly this. Cosine ignores the vector **length** and only compares the **direction**, which is what carries the meaning.`,
    }
  },
}

const chunking: MathExercise = {
  id: 'gen-chunking',
  title: 'Sizing a vector index',
  skill: 'Chunks with overlap, storage',
  level: 2,
  generate: (r) => {
    const docTokens = r.pick([2000, 3000, 5000, 8000])
    const size = r.pick([500, 800, 1000])
    const overlap = r.pick([100, 200])
    const docs = r.pick([1000, 5000, 20000])
    const dim = r.pick([768, 1024, 1536])
    const perDoc = Math.ceil((docTokens - overlap) / (size - overlap))
    const mb = (perDoc * docs * dim * 4) / 1e6
    return {
      params: { docTokens, size, overlap, docs, dim },
      statement: md`You index a client's knowledge base: **${enText(docs)} documents** of about **${enText(docTokens)} tokens** each. Each document is cut into chunks of **${size} tokens** with an **overlap of ${overlap} tokens** between consecutive chunks (the window moves forward by ${size - overlap} tokens each time). Every chunk gets an embedding of **${dim} dimensions**, stored as 4-byte floats.

1. How many chunks per document?
2. How many **megabytes** (10⁶ bytes) do all the embeddings take?`,
      fields: [field('Chunks per document', perDoc, 0), field('Storage (MB)', mb, 0, 'MB')],
      hint: md`With overlap, each new chunk adds $\text{size} - \text{overlap}$ new tokens: $\text{chunks} = \left\lceil \dfrac{\text{tokens} - \text{overlap}}{\text{size} - \text{overlap}} \right\rceil$. Storage $= \text{chunks} \times \text{dimensions} \times 4$ bytes.`,
      solution: md`$$\left\lceil \frac{${en(docTokens)} - ${overlap}}{${size} - ${overlap}} \right\rceil = \left\lceil ${en((docTokens - overlap) / (size - overlap), 3)} \right\rceil = ${perDoc}$$

$$${perDoc} \times ${en(docs)} \times ${dim} \times 4 \text{ bytes} \approx ${en(mb, 0)} \text{ MB}$$

Overlap keeps a sentence that straddles two chunks retrievable, at the cost of more chunks. Storage is rarely the problem (a few GB at most for typical company corpora); the real trade-off of chunk size is **retrieval quality**: small chunks are precise but lose context, large chunks keep context but dilute the match and fill the prompt.`,
    }
  },
}

export const embeddingsChapter: Chapter = {
  id: 'gen-embeddings',
  title: 'Embeddings & semantic search',
  emoji: '🧭',
  summary: 'Turning text into vectors, cosine similarity, keyword vs semantic vs hybrid search, chunking and vector databases.',
  lesson: md`## The problem

A user asks *"Can I get my money back if the parcel never arrived?"*. The right help article is titled *"Refunds for lost deliveries"*. A **keyword search** finds no shared word except "the". We need a search that understands **meaning**.

## Embeddings

An **embedding model** turns a piece of text into a vector of numbers (typically 384 to 3,072 dimensions) such that **texts with similar meanings get similar vectors**. "money back" and "refund" end up close; "refund" and "pizza" end up far apart.

- It is a different model from the chat LLM (smaller, cheaper, often run by the same provider or open source).
- The **same** embedding model must be used for the documents and for the questions: vectors from two different models are not comparable.

## Measuring similarity

The standard measure is the **cosine similarity**:
$$\cos(u, v) = \frac{u \cdot v}{\|u\|\,\|v\|} \in [-1, 1]$$
1 means same direction (same meaning), 0 unrelated. Many embedding models output normalised vectors ($\|u\| = 1$), in which case the cosine is just the dot product.

## Semantic search in 4 steps

1. **Chunk** the documents into passages (a few hundred tokens each).
2. **Embed** every chunk and store the vectors in a **vector database** (or a simple index for small corpora).
3. At query time, **embed the question**.
4. Return the **top-k** chunks with the highest similarity.

Vector databases use **approximate nearest-neighbour (ANN)** search to find the closest vectors among millions in milliseconds, trading a tiny bit of accuracy for a lot of speed.

## Keyword, semantic or hybrid?

| Search | Strengths | Weaknesses |
|---|---|---|
| **Keyword** (BM25) | exact terms, product codes, names, IDs; transparent | misses synonyms and paraphrases |
| **Semantic** (embeddings) | meaning, paraphrases, other languages | can miss exact codes ("error E-4012"), harder to explain |
| **Hybrid** | combines both scores (often the best in practice) | one more thing to tune |

**BM25** is the classic keyword score: it rewards words that appear often in the passage (term frequency, with diminishing returns) but are **rare in the collection** (inverse document frequency), and corrects for passage length.

## Chunking matters

- **Too small** (one sentence): precise matches but missing context ("it costs 20 €": what does?).
- **Too large** (whole documents): the relevant sentence is diluted, and you waste the context window.
- Common starting point: 200–1,000 tokens with some **overlap**, split on natural boundaries (headings, paragraphs), and keep **metadata** (title, date, source) for filtering and citations.

## In a client conversation

> "We turn every paragraph of your documentation into a vector that captures its meaning, so that a question finds the right passage even if it uses different words. We combine it with classic keyword search so that product codes and names are still found exactly."`,
  formulas: [
    { name: 'Cosine similarity', tex: md`\cos(u, v) = \frac{u \cdot v}{\|u\|\,\|v\|}` },
    { name: 'Number of chunks with overlap', tex: md`\left\lceil \frac{\text{tokens} - \text{overlap}}{\text{size} - \text{overlap}} \right\rceil` },
    { name: 'Embedding storage', tex: md`\text{chunks} \times \text{dimensions} \times 4 \text{ bytes}` },
  ],
  exercises: [
    conceptQuiz('gen-embeddings-concepts', 'Embeddings in practice', 'Vectors, similarity, search', 1, [
      {
        q: 'What does an embedding model produce?',
        options: [
          ["A list of numbers representing the meaning of a text", "Correct: similar texts get similar vectors, which is what makes semantic search possible."],
          ["A short summary of the text, used to index it", "That is a generative task; embeddings are vectors, not text."],
          ["The key words of the text, each weighted by its importance", "That is keyword extraction (like TF-IDF); embeddings capture meaning beyond exact words."],
          ["A probability for each word of being in the text", "That is closer to a language model's output; an embedding is one vector for the whole text."],
        ],
        takeaway: 'Embedding = text → vector; closeness of vectors ≈ closeness of meaning.',
      },
      {
        q: 'You embedded the documents with model A last year. You now embed user questions with a newer model B. What happens?',
        options: [
          ["Search breaks: the two models' vectors are not comparable, so re-embed the documents with B", "Correct: each model has its own vector space."],
          ["Search improves, because model B understands questions better than model A did", "Only if documents and questions are both embedded with B; mixing spaces breaks search."],
          ["It keeps working as long as both models produce vectors of the same dimension, e.g. 1,024", "Same dimension does not mean same space: the coordinates mean different things."],
          ["Scores drop a little, so you should lower the similarity threshold to compensate", "The scores do not just drop, they become noise: no threshold fixes it."],
        ],
        takeaway: 'Documents and queries must be embedded with the same model (re-index when you change it).',
      },
      {
        q: 'Users search for error codes like "E-4012". Pure semantic search often misses them. Best fix?',
        options: [
          ["Hybrid search: combine keyword search (BM25) with semantic search", "Correct: keyword search excels at exact identifiers, semantic search at paraphrases."],
          ["A larger embedding model, which captures rare tokens like codes better", "Might help slightly; exact codes remain a known weakness of embeddings."],
          ["A reranker on the top 20 results of the semantic search", "A reranker can only reorder what was retrieved; if the code's passage is not in the top 20, it cannot bring it back."],
          ["Larger chunks, so each one contains more error codes", "Unrelated to matching exact codes, and it dilutes each chunk's meaning."],
        ],
        takeaway: 'Hybrid search (BM25 + embeddings) is a strong, common default.',
      },
      {
        q: 'Two embeddings have a cosine similarity of 0.98. This means…',
        options: [
          ["The two texts are very close in meaning", "Correct: cosine close to 1 = same direction = similar meaning."],
          ["The texts share 98 % of their words", "Cosine measures semantic closeness, not word overlap."],
          ["One text is 98 % the length of the other", "Cosine ignores length."],
          ["The model is 98 % sure they are related", "Similarity is not a probability."],
        ],
        takeaway: 'Cosine ∈ [−1, 1]: close to 1 = similar meaning.',
      },
      {
        q: 'Why do vector databases use approximate nearest-neighbour (ANN) search?',
        options: [
          ["To find the closest vectors among millions in milliseconds, at the cost of rare misses", "Correct: exact search compares the query with every vector, which is too slow at scale."],
          ["Because embeddings are approximate anyway, so an exact search would be meaningless", "Exact search is possible and meaningful; it is just slow on large collections."],
          ["To compress the vectors so that the whole index fits in the memory of a single server", "Some indexes compress vectors too, but the purpose of ANN is speed; compression is a separate technique."],
          ["To return results ranked by relevance instead of by insertion order in the index", "Exact search also ranks by similarity; ANN trades a little accuracy for speed."],
        ],
        takeaway: 'ANN = fast, slightly approximate search over many vectors.',
      },
    ]),
    conceptQuiz('gen-chunking-concepts', 'Chunking strategy', 'Size, overlap, metadata', 2, [
      {
        q: 'Retrieved chunks are one sentence long and the model often lacks context to answer. What to change?',
        options: [
          ["Use larger chunks (a few paragraphs) split on natural boundaries", "Correct: tiny chunks lose the surrounding context; overlap can help too."],
          ["Increase k from 5 to 30 so that more sentences reach the model", "More isolated sentences, often from unrelated places, not the context around the right one."],
          ["Use a bigger LLM, which is better at answering from little context", "The missing context is not in the prompt; no model can use what it does not see."],
          ["Switch from semantic search to keyword search on the sentences", "The issue is chunk size, not the search method."],
        ],
        takeaway: 'Too small chunks lose context; too large chunks dilute relevance. Tune on real questions.',
      },
      {
        q: 'What is the main purpose of overlap between consecutive chunks?',
        options: [
          ["So that an idea cut at a chunk boundary is kept whole in at least one chunk", "Correct: overlap keeps boundary content retrievable."],
          ["So that the index contains fewer chunks and searches run faster", "Overlap makes the index bigger (more chunks), not smaller."],
          ["So that consecutive chunks get similar embeddings and rank next to each other", "Not the goal: you usually want the single best chunk, and near-duplicates can even crowd the results."],
          ["So that duplicated passages are detected and removed from results", "Overlap actually creates partial duplicates; it does not remove them."],
        ],
        takeaway: 'Overlap protects ideas that straddle a boundary, at the cost of more chunks.',
      },
      {
        q: 'Why store metadata (document title, date, department) with each chunk?',
        options: [
          ["To filter results (e.g. only the current version) and to cite sources", "Correct: metadata enables filters, freshness rules and citations."],
          ["Because the vector database cannot store embeddings without them", "Embeddings can be stored alone; metadata adds value on top."],
          ["To improve the embeddings, since the title is embedded with the chunk", "Some systems do add titles to the embedded text, but that is not why metadata is stored as fields."],
          ["To make each chunk shorter by moving its header and title into separate fields", "Metadata adds information; it does not shorten chunks."],
        ],
        takeaway: 'Keep metadata: filters (version, access rights, date) and citations.',
      },
      {
        q: 'A client has 200 short FAQ entries (one question + answer each). Sensible chunking?',
        options: [
          ["One chunk per FAQ entry (question and answer together)", "Correct: the natural unit is already small and self-contained."],
          ["Fixed 1,000-token chunks running across all the entries", "That would mix unrelated entries in the same chunk."],
          ["One chunk per sentence, to get the most precise matches", "That would separate questions from their answers."],
          ["Two chunks per entry: one for the question, one for the answer", "Matching the question chunk would not bring its answer with it."],
        ],
        takeaway: 'Chunk along the natural structure of the documents when there is one.',
      },
    ]),
    cosine,
    chunking,
  ],
}
