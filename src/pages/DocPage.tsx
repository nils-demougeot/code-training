import { BookMarked } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { DocBrowser } from '@/components/DocBrowser'
import { PageHeader } from '@/components/ui'

export default function DocPage() {
  const [params] = useSearchParams()
  return (
    <div>
      <PageHeader
        icon={<BookMarked className="size-6" />}
        title="Documentation"
        subtitle="Les fonctions essentielles de Python, NumPy, Pandas, scikit-learn, PyTorch, SQL et scipy.stats, avec des exemples exécutables. Dans un exercice : bouton Doc ou F2 sur un mot."
      />
      <div className="card h-[calc(100vh-14rem)] min-h-[32rem] overflow-hidden">
        <DocBrowser initialQuery={params.get('q') ?? ''} initialLib={params.get('lib')} autoFocus />
      </div>
    </div>
  )
}
