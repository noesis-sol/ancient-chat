'use client';
import { useState } from 'react';

type AccordionItem = {
  title: string;
  content: string;
};

interface AccordionSectionProps {
  accordionData: AccordionItem[];
}

const AccordionSection = ({ accordionData }: AccordionSectionProps) => {
  const [openSection, setOpenSection] = useState<number | null>(null);

  const toggleSection = (index: number) => {
    setOpenSection(openSection === index ? null : index);
  };

  if (!accordionData?.length) {
    return null;
  }

  return (
    <div className='w-full mx-auto space-y-2'>
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
