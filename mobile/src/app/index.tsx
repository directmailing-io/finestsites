import { Redirect } from 'expo-router';

import { useAuth } from '@/lib/auth';

export default function Index() {
  const status = useAuth(s => s.status);
  return <Redirect href={status === 'signedIn' ? '/sites' : '/login'} />;
}
