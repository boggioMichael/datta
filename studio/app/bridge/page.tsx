import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { allowedOrigin, validChannel } from '@/lib/bridge-policy.mjs';
import Bridge from './session';
export const dynamic = 'force-dynamic';
export default async function BridgePage({searchParams}:{searchParams:Promise<{origin?:string;channel?:string}>}) {
  const {origin = '',channel = ''} = await searchParams;
  if (!allowedOrigin(origin,process.env.NODE_ENV === 'development') || !validChannel(channel)) return <main className="session-page"><h1>Open your DATTA studio</h1><p>This session must start from your admin page.</p><a href="https://boggiomichael.github.io/datta/admin/">Go to DATTA →</a></main>;
  await requireChatGPTUser('/bridge?'+new URLSearchParams({origin,channel}));
  return <Bridge origin={origin} channel={channel}/>;
}
