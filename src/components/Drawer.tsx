import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer';
import styles from './Drawer.module.css';

export function Drawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DrawerPrimitive.Trigger className="button">Open drawer</DrawerPrimitive.Trigger>
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Backdrop className={styles.Backdrop} />
        <DrawerPrimitive.Viewport className={styles.Viewport}>
          <DrawerPrimitive.Popup className={styles.Popup}>
            <div className={styles.Handle} />
            <DrawerPrimitive.Content className={styles.Content}>
              <DrawerPrimitive.Title className={styles.Title}>Notifications</DrawerPrimitive.Title>
              <DrawerPrimitive.Description className={styles.Description}>
                You are all caught up. Good job!
              </DrawerPrimitive.Description>
              <div className={styles.Actions}>
                <DrawerPrimitive.Close className="button">Close</DrawerPrimitive.Close>
              </div>
            </DrawerPrimitive.Content>
          </DrawerPrimitive.Popup>
        </DrawerPrimitive.Viewport>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}
