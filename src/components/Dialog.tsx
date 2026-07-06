import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import styles from './Dialog.module.css';

export function Dialog({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger className="button">Open dialog</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className={styles.Backdrop} />
        <DialogPrimitive.Popup className={styles.Popup}>
          <div className={styles.Intro}>
            <DialogPrimitive.Title className={styles.Title}>Base UI Dialog</DialogPrimitive.Title>
            <DialogPrimitive.Description className={styles.Description}>
              You're dismissed.
            </DialogPrimitive.Description>
          </div>
          <div className={styles.Actions}>
            <DialogPrimitive.Close className="button">Close</DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
