export default function ProgressBar({ progress }) {
  return <div className="progressBar" style={{ width: `${progress}%` }} />;
}
