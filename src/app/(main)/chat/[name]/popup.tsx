import { ContextSource, sourceLabel } from '@/utils/context-sources';
import { useId } from 'react';

export default function Popup({ title, sources }: { title: string; sources: ContextSource[] }) {
  const id = useId();

  return (
    <>
      <label htmlFor={id} className='btn btn-link min-h-0 h-auto'>
        {title}
      </label>
      <input type='checkbox' id={id} className='modal-toggle' />
      <label htmlFor={id} className='modal'>
        <div className='modal-box max-w-3xl max-h-[80vh] text-base-content'>
          <h3 className='font-bold text-2xl'>Sources</h3>
          <div className='p-4'>
            <ol className='list'>
              {sources.map((source) => (
                <li className='py-5 flex flex-col' key={`${source.index}/${source.id}`}>
                  <p className='grow whitespace-pre-line text-lg leading-relaxed'>{source.text}</p>
                  <p className='flex justify-end italic text-base' title={source.source}>
                    -- {sourceLabel(source)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </label>
    </>
  );
}
