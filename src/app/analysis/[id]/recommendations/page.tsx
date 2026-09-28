import Header from '@/components/layout/Header';
import PageBar from '@/components/layout/PageBar';
import RecommendationsClient from './RecommendationsClient';

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function RecommendationsPage(props: Props) {
  const params = await props.params;

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <Header />

      <PageBar
        titleKey="recTitle"
        backHref={`/analysis/${params.id}`}
        backLabelKey="back"
        actionHref={`/analysis/${params.id}/report`}
        actionLabelKey="generateReport"
      />

      <main className="flex-grow p-4 md:p-6 max-w-7xl mx-auto w-full">
        <RecommendationsClient tenderId={params.id} />
      </main>
    </div>
  );
}
