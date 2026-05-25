import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AcceptInvitationClient } from '@/components/dashboard/team/AcceptInvitationClient';

interface AcceptPageProps {
  params: Promise<{ token: string }>;
}

export default async function AcceptInvitationPage({ params }: AcceptPageProps) {
  const { token: inviteToken } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect(`/sign-in?redirect_url=/invitations/${inviteToken}/accept`);
  }

  return <AcceptInvitationClient token={inviteToken} />;
}
