import AccordionSection from '@/components/accordion';
import IndexUploadModal from '@/components/file-upload-modal';
import { IndexesService } from '@/data/indexes.service';
import { adminEmails } from '@/utils/emails';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const indexesService = new IndexesService();

export default async function AdminPage() {
  const user = await currentUser();

  if (!user || !user?.emailAddresses?.some((email) => adminEmails.includes(email.emailAddress))) {
    redirect('/');
  }

  //get all indexes from pinecone

  const indexes = await indexesService.getIndexes();

  const myAccordionData =
    indexes?.map((index) => {
      return {
        id: index.id,
        title: index.name,
        content: index.id,
        isActive: index.is_active,
        weight: index.weight,
        ancient: index.ancient
      };
    }) ?? [];

  return (
    <div className='pt-5 flex flex-col gap-4 min-w-[90%]'>
      <div className='flex justify-end'>
        <IndexUploadModal />
      </div>
      <AccordionSection data={myAccordionData} />
    </div>
  );
}
