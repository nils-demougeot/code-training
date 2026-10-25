import type { MathExercise } from '../maths/core'

/** A multiple-choice question with an explanation for every option. */
export interface ConceptQuestion {
  q: string
  /** The first option is the correct one (options are shuffled when shown). */
  options: [string, string][]
  /** The idea to remember, shown after answering. */
  takeaway: string
}

/** An exercise that draws one question from a bank on the same skill. */
export function conceptQuiz(id: string, title: string, skill: string, level: 1 | 2 | 3, bank: ConceptQuestion[]): MathExercise {
  return {
    id,
    title,
    skill,
    level,
    generate: (r) => {
      const index = Math.floor(r.next() * bank.length)
      const item = bank[index]
      const order = r.sample(item.options.map((_, i) => i), item.options.length)
      const options = order.map((i) => item.options[i][0])
      return {
        params: { question: index, correct: item.options[0][0] },
        statement: item.q,
        fields: [],
        choice: { options, answer: order.indexOf(0), explanations: order.map((i) => item.options[i][1]) },
        hint: 'Eliminate the options that are clearly wrong first, then compare the remaining ones against the lesson.',
        solution: item.takeaway,
      }
    },
  }
}

/** English number for statements and KaTeX: 1234.5 → "1{,}234.5" in math mode. */
export function en(x: number, decimals = 4): string {
  return Number(x.toFixed(decimals)).toLocaleString('en-US', { maximumFractionDigits: decimals }).replace(/,/g, '{,}')
}

/** Same, for plain text (outside math). */
export function enText(x: number, decimals = 4): string {
  return Number(x.toFixed(decimals)).toLocaleString('en-US', { maximumFractionDigits: decimals })
}

/** "$1,234.50" for money. The dollar is escaped (\\$) so that Markdown math does not start a formula;
 * the same text also works inside KaTeX. */
export const usd = (x: number, decimals = 2) =>
  `\\$${x.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
