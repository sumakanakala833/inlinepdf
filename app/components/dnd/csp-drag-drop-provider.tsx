import type { PropsWithChildren } from 'react';
import {
  DragDropProvider,
  KeyboardSensor,
  PointerSensor,
  type DragDropEventHandlers,
} from '@dnd-kit/react';

type CspDragDropProviderProps = PropsWithChildren<Partial<DragDropEventHandlers>>;

function isInteractiveElement(target: EventTarget | null, source: Element | undefined): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const interactiveAncestor = target.closest(
    'button, a, input, select, textarea, [contenteditable="true"], [data-dnd-interactive="true"]',
  );

  return interactiveAncestor !== null && interactiveAncestor !== source;
}

export function CspDragDropProvider({
  children,
  ...eventHandlers
}: CspDragDropProviderProps) {
  return (
    <DragDropProvider
      sensors={[
        PointerSensor.configure({
          preventActivation: (event, source) =>
            isInteractiveElement(event.target, source.element),
        }),
        KeyboardSensor.configure({
          preventActivation: (event, source) =>
            isInteractiveElement(event.target, source.element),
        }),
      ]}
      {...eventHandlers}
    >
      {children}
    </DragDropProvider>
  );
}
