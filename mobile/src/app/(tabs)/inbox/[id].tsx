import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';

import { getSubmissions } from '@/api/endpoints';
import type { Submission, SubmissionList } from '@/api/types';
import { EmptyState, Screen, Skeleton } from '@/components/ui';
import { SubmissionDetail } from '@/features/inbox/SubmissionDetail';
import { radius } from '@/theme/tokens';

/** Einzelne Anfrage (iPhone, Mitteilungen, Links). Sucht erst im Cache, dann beim Server. */
export default function SubmissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const fromCache = () => {
    for (const [, data] of qc.getQueriesData<SubmissionList>({ queryKey: ['submissions'] })) {
      const hit = data?.submissions.find(s => s.id === id);
      if (hit) return hit;
    }
    return undefined;
  };

  const q = useQuery<Submission | null>({
    queryKey: ['submissions', 'one', id],
    initialData: fromCache,
    queryFn: async () => {
      const [all, archived] = await Promise.all([getSubmissions({ status: 'all' }), getSubmissions({ status: 'archived' })]);
      return [...all.submissions, ...archived.submissions].find(s => s.id === id) ?? null;
    },
  });

  return (
    <Screen readable>
      {q.data ? (
        <SubmissionDetail submission={q.data} onRemoved={() => router.back()} />
      ) : q.isLoading ? (
        <Skeleton height={320} radius={radius.card} />
      ) : (
        <EmptyState icon={MessageSquare} title="Anfrage nicht gefunden" text="Vielleicht wurde sie gelöscht." />
      )}
    </Screen>
  );
}
