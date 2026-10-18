export default function SidebarOverlay({ show, onClose }) {
  return <div className={`sidebarOverlay ${show ? 'show' : ''}`} onClick={onClose} />;
}
