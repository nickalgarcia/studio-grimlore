import * as React from 'react';

import {cn} from '@/lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({className, ...props}, ref) => {
    return (
      <textarea
        className={cn(
          'min-h-[80px] flex w-full border-[1.5px] border-line2 bg-panel px-3 py-2 font-body text-[18px] text-ink placeholder:text-mute focus-visible:outline-none focus-visible:border-ink disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export {Textarea};
