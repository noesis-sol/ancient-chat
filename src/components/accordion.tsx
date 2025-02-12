'use client';
import { useState } from 'react';

export type AccordionItem = {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
};

interface AccordionSectionProps {
  data: AccordionItem[];
}

const AccordionSection = ({ data }: AccordionSectionProps) => {
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [deleteTitle, setDeleteTitle] = useState<string | null>(null);
  const [accordionData, setAccordionData] = useState<AccordionItem[]>(data);

  const toggleSection = (index: number) => {
    setOpenSection(openSection === index ? null : index);
  };

  if (!accordionData?.length) {
    return null;
  }

  const onDelete = async (title: string) => {
    const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/indexes/${title}`, {
      method: 'DELETE'
    });
    const { success } = (await result.json()) as { success: boolean };
    if (success) {
      removeSection(title);
      setDeleteTitle(null); // Close modal after successful deletion
    }
  };

  const removeSection = (title: string) => {
    const index = accordionData.findIndex((section) => section.title === title);
    if (index !== -1) {
      const newAccordionData = [...accordionData];
      newAccordionData.splice(index, 1);
      setAccordionData(newAccordionData);
      setOpenSection(null);
    }
  };

  const toggleActive = async (title: string, currentState: boolean) => {
    try {
      const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/indexes/${title}/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive: !currentState })
      });

      const { success } = await result.json();
      if (success) {
        setAccordionData((prev) =>
          prev.map((item) => (item.title === title ? { ...item, isActive: !item.isActive } : item))
        );
      }
    } catch (error) {
      console.error('Failed to toggle active state:', error);
    }
  };

  return (
    <>
      <div className='w-full mx-auto space-y-2'>
        {accordionData.map((section, index) => (
          <div key={index} className='border rounded-lg overflow-hidden'>
            <div className='flex justify-between items-center p-4'>
              <span className='font-medium'>{section.title}</span>

              <div className='flex items-center'>
                <input
                  type='checkbox'
                  checked={!!section.isActive}
                  onChange={() => toggleActive(section.title, section.isActive)}
                  className='toggle checked:bg-primary'
                />
                <button
                  onClick={() => toggleSection(index)}
                  className='w-full p-4 text-left flex justify-between items-center hover:cursor-pointer'
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${
                      openSection === index ? 'transform rotate-180' : ''
                    }`}
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                  </svg>
                </button>
              </div>
            </div>
            <div
              className={`transition-all duration-200 ease-in-out ${
                openSection === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
              } overflow-hidden`}
            >
              <div className='p-4 flex justify-between items-center'>
                <div>{section.content}</div>
                <button onClick={() => setDeleteTitle(section.title)} className='btn btn-outline btn-error'>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <dialog id='delete_modal' className={`modal ${deleteTitle ? 'modal-open' : ''}`}>
        <div className='modal-box'>
          <h3 className='font-bold text-lg'>Confirm Deletion</h3>
          <p className='py-4'>
            Are you sure you want to delete &quot;{deleteTitle}&quot;? This action cannot be undone.
          </p>
          <div className='modal-action'>
            <button className='btn btn-outline' onClick={() => setDeleteTitle(null)}>
              Cancel
            </button>
            <button className='btn btn-error' onClick={() => deleteTitle && onDelete(deleteTitle)}>
              Delete
            </button>
          </div>
        </div>
        <form method='dialog' className='modal-backdrop'>
          <button onClick={() => setDeleteTitle(null)}>close</button>
        </form>
      </dialog>
    </>
  );
};

export default AccordionSection;
