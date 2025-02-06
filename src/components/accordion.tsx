'use client';
import { useState } from 'react';

type AccordionItem = {
  title: string;
  content: string;
};

interface AccordionSectionProps {
  accordionData: AccordionItem[];
  onDelete?: (indexName: string) => void;
}

const AccordionSection = ({ accordionData, onDelete }: AccordionSectionProps) => {
  const [openSection, setOpenSection] = useState<number | null>(null);

  const toggleSection = (index: number) => {
    setOpenSection(openSection === index ? null : index);
  };

  if (!accordionData?.length) {
    return null;
  }

  return (
    <div className='w-full  mx-auto space-y-2'>
      {accordionData.map((section, index) => (
        <div key={index} className='border rounded-lg overflow-hidden'>
          <button
            onClick={() => toggleSection(index)}
            className='w-full p-4 text-left flex justify-between items-center'
          >
            <span className='font-medium'>{section.title}</span>
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
          {onDelete && (
            <button onClick={() => onDelete(section.title)} className='ml-4 p-2 text-red-600 hover:bg-red-50 rounded'>
              <svg className='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                />
              </svg>
            </button>
          )}
          <div
            className={`transition-all duration-200 ease-in-out ${
              openSection === index ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'
            } overflow-hidden`}
          >
            <div className='p-4'>{section.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AccordionSection;
