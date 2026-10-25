import type { MathExercise } from '../core'

export interface FormulaQuestion {
  q: string
  correct: string
  wrong: string[]
}

/** A multiple-choice exercise drawn from a bank of questions on the chapter's formulas. */
export function formulaQuiz(id: string, title: string, bank: FormulaQuestion[]): MathExercise {
  return {
    id,
    title,
    skill: 'Reconnaître les formules du cours',
    level: 1,
    boss: false,
    generate: (r) => {
      const index = Math.floor(r.next() * bank.length)
      const item = bank[index]
      const options = r.sample([item.correct, ...item.wrong], item.wrong.length + 1)
      return {
        params: { question: index, correct: item.correct },
        statement: item.q,
        fields: [],
        choice: { options, answer: options.indexOf(item.correct) },
        hint: 'Repense à la formule du cours, ou teste chaque proposition sur un cas simple (une pièce, un dé, des événements impossibles…).',
        solution: `La bonne réponse est ${item.correct}.`,
      }
    },
  }
}
