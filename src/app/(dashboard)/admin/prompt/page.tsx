import EditPrompt from '@/app/(dashboard)/admin/prompt/prompt-editor';
import { redirectNonAdmin } from '@/utils/adminAuth';

export default async function EditPromptPage() {
  await redirectNonAdmin();

  return <EditPrompt />;
}
