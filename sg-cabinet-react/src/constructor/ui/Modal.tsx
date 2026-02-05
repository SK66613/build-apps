import React from 'react';

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}:{
  open: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: ()=>void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}){
  React.useEffect(()=>{
    if (!open) return;
    const onKey = (e: KeyboardEvent)=>{
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return ()=>window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ctorModal" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="ctorModal__panel" onMouseDown={(e)=>e.stopPropagation()}>
        <div className="ctorModal__hdr">
          <div className="ctorModal__hdrL">
            <div className="ctorModal__title">{title}</div>
            {subtitle ? <div className="ctorModal__sub">{subtitle}</div> : null}
          </div>

          <button className="ctorModal__close" onClick={onClose} type="button">
            Закрыть
          </button>
        </div>

        <div className="ctorModal__body">
          {children}
        </div>

        {footer ? (
          <div className="ctorModal__ftr">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Modal;
