import type { Chapter } from '../maths/core'
import { agentsChapter } from './chapters/agents'
import { embeddingsChapter } from './chapters/embeddings'
import { evaluationChapter } from './chapters/evaluation'
import { llmChapter } from './chapters/llm'
import { productionChapter } from './chapters/production'
import { promptingChapter } from './chapters/prompting'
import { ragChapter } from './chapters/rag'

/** GenAI Academy chapters (English), played with the maths course engine. */
export const GENAI_CHAPTERS: Chapter[] = [llmChapter, promptingChapter, embeddingsChapter, ragChapter, evaluationChapter, agentsChapter, productionChapter]
