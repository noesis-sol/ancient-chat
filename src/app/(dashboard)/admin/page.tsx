import AccordionSection from '@/components/accordion';
import IndexUploadModal from '@/components/file-upload-modal';
import { IndexesService } from '@/data/indexes.service';
import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

const approvedEmails = [
  'adam@agr-series.com',
  'michael@agr-series.com',
  'michael@noesis.solutions',
  'andreas@noesis.solutions'
];

export default async function AdminPage() {
  const indexesService = new IndexesService();
  const user = await currentUser();
  const [email] = user?.emailAddresses ?? [];

  if (!user || !approvedEmails.includes(email?.emailAddress ?? '')) {
    redirect('/');
  }

  //get all indexes from pinecone

  let indexes = await indexesService.getActiveIndexes();

  const myAccordionData =
    indexes?.map((index) => {
      return {
        title: index.name,
        content: index.id,
        isActive: index.is_active
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
